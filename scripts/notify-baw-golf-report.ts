/**
 * notify-baw-golf-report.ts — ask Baw to deliver the golf donor report files
 * to Johnny's Telegram. Same inbound.db injection pattern as notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'File delivery for Johnny — ACTION NOW. He asked for the Refinery Classic donor report as PDF + CSV so he can download them from this chat.\n\n' +
  'Both files are in your workspace:\n' +
  '• /workspace/agent/reports/refinery-classic-donors-all-time.pdf\n' +
  '• /workspace/agent/reports/refinery-classic-donors-all-time.csv\n\n' +
  'Send BOTH to this chat with send_file. Suggested caption for the pair: "The Refinery Classic — all-time donor report (2012–2026, incl. Golf Fore the Homeless): 202 donors, $411,390 raised, with addresses. PDF for reading, CSV for Excel/mail-merge."\n\n' +
  'Context if he asks: report covers every won gift on the 15 golf tournament campaigns 2012–2026 under both event names, plus 5 unlinked golf-named gifts ($6,500). 20 donors have no street address in Salesforce (blank address columns in the CSV). This year (2026) is the record: $66,212.';

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
).run({ id, seq, ts: new Date().toISOString(), platformId: PLATFORM_ID, channel: CHANNEL, content });
db.close();
console.log(`Injected file-delivery request id=${id} seq=${seq}`);
