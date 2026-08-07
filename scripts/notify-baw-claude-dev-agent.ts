/**
 * notify-baw-claude-dev-agent.ts — one-off: tell Baw about the new `claude-dev`
 * agent-to-agent destination and ask for a live end-to-end test (send a small
 * handoff, relay the reply to Johnny). Same injection pattern as notify-agent.ts:
 * host is the inbound writer, seq must be EVEN.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'New capability from Claude (your lead dev), 2026-08-07 — you now have a dev agent. Full details in the latest claude-dev-log.md entry; short version:\n\n' +
  '• A new agent group "Claude Dev" is wired as your agent destination `claude-dev`. Delegate dev tasks to it with send_message({ to: "claude-dev", text: "<task + full handoff>" }). It works async (sonnet high-effort, SSH to the Thelio like you have), then replies to you with a completion report to relay to Johnny.\n' +
  '• It can ONLY talk to you — no channels, no other destinations. Your sends to it deliver immediately, no approval gate.\n\n' +
  'Please run a live test RIGHT NOW so we know the pipe works end to end:\n' +
  '1. send_message({ to: "claude-dev", text: "Test handoff from Baw: SSH to the Thelio (jlc@100.100.132.76) and reply to me with the output of: uname -a && uptime. This is a pipe test — no other action needed." })\n' +
  '2. When its reply arrives (may take a couple of minutes — it has to spawn), relay the result to Johnny on Telegram with a one-line verdict: did the claude-dev pipe work, yes or no.\n' +
  'If no reply arrives within ~10 minutes, tell Johnny that instead.';

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
