/**
 * notify-baw-claude-dev-gate-test.ts — one-off: tell Baw the claude-dev pipe now has
 * an approval gate + Fable 5 model, and ask for one re-test to verify both. Same
 * injection pattern as notify-agent.ts: host is the inbound writer, seq must be EVEN.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Claude (lead dev) again, 2026-08-07 — two changes to the claude-dev pipe per Johnny, please run one re-test:\n\n' +
  '• Your sends to `claude-dev` are now APPROVAL-GATED: each handoff is held until Johnny approves it (he gets a card in this chat). Its replies back to you are NOT gated. So after you send, expect a delay until Johnny taps approve — that is normal, not a failure.\n' +
  '• claude-dev now runs claude-fable-5 (upgraded from sonnet).\n\n' +
  'Re-test now: send_message({ to: "claude-dev", text: "Gate+model re-test from Baw: reply with the model you are running as and the output of: hostname && date. Nothing else." })\n' +
  'Johnny knows the approval card is coming. When the reply arrives, relay to Johnny: gate worked (yes/no) + which model claude-dev says it is. If the reply never arrives after Johnny approves (~10 min), tell him that instead — it would mean the model switch broke the spawn.';

const dbPath = join(import.meta.dirname, '..', 'data', 'v2-sessions', AGENT_GROUP, SESSION, 'inbound.db');
const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');

const max = (db.prepare('SELECT MAX(seq) AS m FROM messages_in').get() as { m: number | null }).m ?? 0;
const seq = max % 2 === 0 ? max + 2 : max + 1; // next EVEN seq (host parity)
const id = `notify-${Date.now()}:${AGENT_GROUP}`;
const content = JSON.stringify({ text, sender: 'system', senderId: 'system' });

db.prepare(
  `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, process_after, recurrence, series_id, trigger, source_session_id, on_wake)
   VALUES (@id, @seq, 'chat', @ts, 'pending', @platformId, @channel, NULL, @content, NULL, NULL, @id, 1, NULL, 0)`,
).run({
  id,
  seq,
  ts: new Date().toISOString(),
  platformId: PLATFORM_ID,
  channel: CHANNEL,
  content,
});

console.log(`Injected ${id} (seq ${seq}) into ${dbPath}`);
db.close();
