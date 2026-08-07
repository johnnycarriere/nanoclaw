/**
 * notify-baw.ts — generic: inject a system notice into Baw's main Telegram session so
 * Baw reads it and (typically) relays to Johnny. Replaces the per-event one-off
 * notify-baw-*.ts scripts for simple cases.
 *
 * Usage:
 *   pnpm exec tsx scripts/notify-baw.ts --text "message"
 *   pnpm exec tsx scripts/notify-baw.ts --file path/to/message.md
 *   echo "message" | pnpm exec tsx scripts/notify-baw.ts
 *
 * Host is the inbound writer, so seq must be EVEN. The running container picks the
 * message up on its next poll (~1s); otherwise the 60s host sweep wakes the session.
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

function getText(): string {
  const args = process.argv.slice(2);
  const textIdx = args.indexOf('--text');
  if (textIdx !== -1 && args[textIdx + 1]) return args[textIdx + 1];
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) return readFileSync(args[fileIdx + 1], 'utf-8');
  const stdin = readFileSync(0, 'utf-8');
  if (stdin.trim()) return stdin;
  console.error('Usage: notify-baw.ts --text "msg" | --file msg.md | stdin');
  process.exit(1);
}

const text = getText().trim();
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

console.log(`Injected ${id} (seq ${seq})`);
db.close();
