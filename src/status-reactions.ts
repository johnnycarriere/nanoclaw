/**
 * Host-side status-reaction emitter.
 *
 * Fires emoji reactions on inbound messages based on `processing_ack`
 * transitions: 👨‍💻 when the container claims a message, 👍 when the
 * container marks it completed/failed. Pairs with the 👀 reaction that
 * the telegram adapter fires on initial receive (see telegram.ts onInbound
 * wrapper). The result in the UI: eyes → typing-person → thumbs-up, in
 * sync with the real container lifecycle.
 *
 * State is persisted in the central DB (`host_reaction_state`, migration
 * 014) — *not* in-memory. This is load-bearing: `processing_ack` rows
 * accumulate forever (the container never deletes 'completed' rows; the
 * host's `clearStaleProcessingAcks` only clears 'processing'). With an
 * in-memory map any host restart, container compaction, or sweep tick
 * after the terminal-state delete would re-walk all the historic
 * 'completed' rows and re-fire 👍 on each. Most platforms silently dedupe
 * identical reactions so the regression hid for a while, but a context-
 * compaction reaction storm exposed it (26 simultaneous 👍 re-fires on
 * old messages). Persisting the last-emitted status per message kills
 * both restart-replay and sweep-loop replay.
 */
import type Database from 'better-sqlite3';

import { getChannelAdapter } from './channels/channel-registry.js';
import { getDb } from './db/connection.js';
import { log } from './log.js';

type EmittedStatus = 'processing' | 'completed';

interface AckRow {
  message_id: string;
  status: 'processing' | 'completed' | 'failed';
}

interface InMsgRow {
  id: string;
  channel_type: string;
  platform_id: string;
}

interface ReactionStateRow {
  message_id: string;
  last_emitted: EmittedStatus;
}

/**
 * Inspect processing_ack for newly-seen transitions and emit reactions.
 * Called after syncProcessingAcks() in the sweep loop so we're looking at
 * the current, canonical state.
 */
export async function emitStatusReactions(inDb: Database.Database, outDb: Database.Database): Promise<void> {
  const rows = outDb.prepare('SELECT message_id, status FROM processing_ack').all() as AckRow[];
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.message_id);
  const placeholders = ids.map(() => '?').join(',');

  // Look up the matching inbound rows in one go.
  const inRows = inDb
    .prepare(`SELECT id, channel_type, platform_id FROM messages_in WHERE id IN (${placeholders})`)
    .all(...ids) as InMsgRow[];
  const inById = new Map(inRows.map((r) => [r.id, r]));

  // Pull the durable "already emitted" record for these same ids.
  const centralDb = getDb();
  const stateRows = centralDb
    .prepare(`SELECT message_id, last_emitted FROM host_reaction_state WHERE message_id IN (${placeholders})`)
    .all(...ids) as ReactionStateRow[];
  const stateById = new Map(stateRows.map((r) => [r.message_id, r.last_emitted]));

  const upsertStmt = centralDb.prepare(
    `INSERT INTO host_reaction_state (message_id, last_emitted, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET
       last_emitted = excluded.last_emitted,
       updated_at = excluded.updated_at`,
  );

  for (const row of rows) {
    const last = stateById.get(row.message_id);
    const inMsg = inById.get(row.message_id);
    if (!inMsg) continue;

    if (row.status === 'processing' && last !== 'processing' && last !== 'completed') {
      await fireReaction(inMsg, '👨‍💻');
      upsertStmt.run(row.message_id, 'processing', new Date().toISOString());
    } else if ((row.status === 'completed' || row.status === 'failed') && last !== 'completed') {
      await fireReaction(inMsg, '👍');
      upsertStmt.run(row.message_id, 'completed', new Date().toISOString());
    }
  }
}

/**
 * Idempotent backfill: mark every currently-known completed processing_ack
 * row as already-emitted, without firing reactions. Run once at host
 * startup after migrations, so the first post-upgrade sweep doesn't try
 * to re-fire 👍 across the entire historic backlog (a long-lived agent
 * accumulates hundreds of completed acks; some platforms don't dedupe
 * silently and the user sees a reaction storm). Safe to run on every
 * startup — entries are insert-or-ignored.
 */
export function backfillReactionStateFromOutDb(outDb: Database.Database): void {
  const completed = outDb
    .prepare("SELECT message_id FROM processing_ack WHERE status IN ('completed', 'failed')")
    .all() as Array<{ message_id: string }>;
  if (completed.length === 0) return;

  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO host_reaction_state (message_id, last_emitted, updated_at) VALUES (?, 'completed', ?)`,
  );
  const now = new Date().toISOString();
  const tx = getDb().transaction((rows: Array<{ message_id: string }>) => {
    for (const r of rows) stmt.run(r.message_id, now);
  });
  tx(completed);
}

async function fireReaction(inMsg: InMsgRow, emoji: string): Promise<void> {
  const adapter = getChannelAdapter(inMsg.channel_type);
  if (!adapter?.postReaction) return;
  // Extract the platform-native message id from our composite id.
  // Format: `<chat>:<msgId>:<agentGroupId>`. We need the middle segment.
  const parts = inMsg.id.split(':');
  const nativeMsgId = parts.length >= 2 ? parts[1] : inMsg.id;
  try {
    await adapter.postReaction(inMsg.platform_id, nativeMsgId, emoji);
  } catch (err) {
    log.debug('postReaction failed', { emoji, id: inMsg.id, err });
  }
}
