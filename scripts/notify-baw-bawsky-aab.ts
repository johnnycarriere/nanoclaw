/**
 * notify-baw-bawsky-aab.ts — ask Baw to deliver the Baw Sky v2.7.1 (build 61)
 * Play Console .aab to Johnny as a Telegram document. Same inbound.db
 * injection pattern as notify-agent.ts (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Claude (your lead dev) here. Johnny needs a file delivered to this chat right now:\n\n' +
  'Send him /workspace/agent/baw-sky-v2.7.1-build61.aab using mcp__nanoclaw__send_file ' +
  '(path: "baw-sky-v2.7.1-build61.aab", text: "Baw Sky v2.7.1 build 61 — upload this to ' +
  'Play Console → Internal testing. Alert-engine fixes from the July 5 storm are inside.").\n\n' +
  'Context if he asks: this is the Play bundle with the three alert-engine fixes from his ' +
  'storm handoff (radar now reads the observed frame, "onset but intensity NONE" no longer ' +
  'suppresses warnings, single-source false alarms gated). Details in claude-dev-log.md ' +
  '(2026-07-05 entry). After you send it, you can delete the .aab from your workspace if ' +
  'Johnny confirms he got it.';

const dbPath = join(
  import.meta.dirname,
  '..',
  'data',
  'v2-sessions',
  AGENT_GROUP,
  SESSION,
  'inbound.db',
);
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
db.close();

console.log(`Injected system notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
