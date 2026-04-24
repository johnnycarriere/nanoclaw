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
 * State is in-memory only (Map<message_id, lastEmittedStatus>) — lost on
 * host restart, which is fine: the 👀 reaction from the adapter path is
 * the most important signal and survives; the remaining two are nice-to-
 * have status cues. Entries self-delete once we emit the final reaction.
 */
import type Database from 'better-sqlite3';

import { getChannelAdapter } from './channels/channel-registry.js';
import { log } from './log.js';

type EmittedStatus = 'processing' | 'completed';

const emitted = new Map<string, EmittedStatus>();

interface AckRow {
  message_id: string;
  status: 'processing' | 'completed' | 'failed';
}

interface InMsgRow {
  id: string;
  channel_type: string;
  platform_id: string;
}

/**
 * Inspect processing_ack for newly-seen transitions and emit reactions.
 * Called after syncProcessingAcks() in the sweep loop so we're looking at
 * the current, canonical state.
 */
export async function emitStatusReactions(inDb: Database.Database, outDb: Database.Database): Promise<void> {
  const rows = outDb.prepare('SELECT message_id, status FROM processing_ack').all() as AckRow[];
  if (rows.length === 0) return;

  // Look up the matching inbound rows in one go.
  const ids = rows.map((r) => r.message_id);
  const placeholders = ids.map(() => '?').join(',');
  const inRows = inDb
    .prepare(`SELECT id, channel_type, platform_id FROM messages_in WHERE id IN (${placeholders})`)
    .all(...ids) as InMsgRow[];
  const inById = new Map(inRows.map((r) => [r.id, r]));

  for (const row of rows) {
    const last = emitted.get(row.message_id);
    const inMsg = inById.get(row.message_id);
    if (!inMsg) continue;

    if (row.status === 'processing' && last !== 'processing' && last !== 'completed') {
      await fireReaction(inMsg, '👨‍💻');
      emitted.set(row.message_id, 'processing');
    } else if ((row.status === 'completed' || row.status === 'failed') && last !== 'completed') {
      await fireReaction(inMsg, '👍');
      emitted.delete(row.message_id);
    }
  }

  // Bounded cleanup: purge in-memory entries for messages no longer in
  // processing_ack (container crashed mid-processing; retry will reclaim
  // and re-emit).
  const liveIds = new Set(ids);
  for (const msgId of emitted.keys()) {
    if (!liveIds.has(msgId)) emitted.delete(msgId);
  }
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
