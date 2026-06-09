/**
 * Transient-error auto-retry for tasks whose agent-runner "completed" with
 * an API-connectivity failure (e.g. OneCLI MITM storm during cold start).
 *
 * Why this exists: the agent-runner always calls markCompleted() regardless
 * of whether the SDK returned a real response or an error string like
 * `API Error: Unable to connect to API (ECONNRESET)`. From v2's bookkeeping
 * POV that task succeeded. For recurring tasks that means the next fanout
 * won't retry until tomorrow — which is what cost Johnny's 6am brief on
 * 2026-04-24.
 *
 * Fix: after syncProcessingAcks, scan outbound for recent error-shaped
 * content, look up the originating message, and if it's a fresh completion
 * under MAX_TRIES, clear the processing_ack row and reset messages_in to
 * pending with backoff. Host-sweep's existing `countDueMessages` loop then
 * re-wakes the container when the backoff expires, just like a crashed-
 * mid-processing retry.
 *
 * Writer-invariant note: outbound.db is container-owned. Clearing a
 * processing_ack row from the host IS a documented exception, narrowly
 * scoped to this retry path. The container's poll_loop has already moved
 * on (it wrote the error, then markCompleted) so there's no race.
 */
import type Database from 'better-sqlite3';

import { getMessageForRetry, retryWithBackoff, markMessageFailed, openOutboundDbRw } from './db/session-db.js';
import { log } from './log.js';

const MAX_TRIES = 5;
const BACKOFF_BASE_MS = 60_000; // 60s, 2m, 4m, 8m, 16m — longer than crash-retry

// Error substrings that identify a transient API/proxy failure from the
// Claude Agent SDK / OneCLI gateway. Matches what the SDK emits when the
// upstream connection resets or the MITM proxy can't complete handshake.
// Kept narrow so a legitimate user-facing message that happens to contain
// the word "error" doesn't get retried.
const TRANSIENT_PATTERNS = [
  'ECONNRESET',
  'Unable to connect to API',
  'connection error',
  'serving MITM connection',
  'fetch failed',
  'ETIMEDOUT',
];

interface OutErrorRow {
  in_reply_to: string | null;
  content: string;
  timestamp: string;
}

/** Look for outbound rows with transient-error content within the recent window. */
function findTransientErrors(outDb: Database.Database, sinceSeconds: number): OutErrorRow[] {
  const rows = outDb
    .prepare(
      `SELECT in_reply_to, content, timestamp FROM messages_out
       WHERE in_reply_to IS NOT NULL
         AND datetime(timestamp) >= datetime('now', '-${sinceSeconds} seconds')
         AND kind = 'chat'`,
    )
    .all() as OutErrorRow[];
  return rows.filter((r) => TRANSIENT_PATTERNS.some((p) => r.content.includes(p)));
}

function clearProcessingAck(outDbPath: string, messageId: string): void {
  // Narrow sanctioned host-write to a container-owned table. See header.
  // Open RW briefly so we don't hold a writer through the whole sweep, and
  // so the host's normal outbound reader can stay readonly.
  const db = openOutboundDbRw(outDbPath);
  try {
    db.prepare('DELETE FROM processing_ack WHERE message_id = ?').run(messageId);
  } finally {
    db.close();
  }
}

// Idempotency: a single sweep can see the same error row twice if it
// overlaps with the retry's own re-attempt window. Track per-process what
// we've already retried this hour so we don't double-retry the same
// message id.
const retried = new Map<string, number>();

export function detectAndRetryTransient(inDb: Database.Database, outDb: Database.Database, outDbPath: string): void {
  const errors = findTransientErrors(outDb, /* sinceSeconds */ 30 * 60);
  if (errors.length === 0) return;

  for (const err of errors) {
    const msgId = err.in_reply_to!;
    // Skip if we already retried this message this process lifetime (every
    // retry emits another outbound row; the `since` window would pick it up
    // forever).
    if (retried.has(msgId)) continue;

    // Must currently be in 'completed' state — anything else means the row
    // is already being handled by normal retry or was intentionally failed.
    const row = inDb.prepare('SELECT id, tries, status FROM messages_in WHERE id = ?').get(msgId) as
      | { id: string; tries: number; status: string }
      | undefined;
    if (!row || row.status !== 'completed') continue;

    if (row.tries >= MAX_TRIES) {
      markMessageFailed(inDb, msgId);
      log.warn('Transient error reached MAX_TRIES — marking failed', { id: msgId, tries: row.tries });
      retried.set(msgId, Date.now());
      continue;
    }

    // Reset to pending + clear processing_ack so container can re-claim.
    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, row.tries);
    const backoffSec = Math.floor(backoffMs / 1000);
    inDb.prepare("UPDATE messages_in SET status = 'pending' WHERE id = ?").run(msgId);
    retryWithBackoff(inDb, msgId, backoffSec);
    clearProcessingAck(outDbPath, msgId);
    retried.set(msgId, Date.now());

    log.info('Retrying message after transient error', {
      id: msgId,
      tries: row.tries,
      backoffMs,
      pattern: TRANSIENT_PATTERNS.find((p) => err.content.includes(p)),
    });
  }

  // Prune retried map: entries older than 2 hours drop out so a fresh
  // tomorrow can retry the same message-id-stem if needed.
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, ts] of retried) {
    if (ts < cutoff) retried.delete(id);
  }
}
