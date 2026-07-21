/**
 * One-off: tell Baw De Claw the Refinery Class Attendance feature is done.
 * Injects a system 'chat' notice into the live session inbound.db (host writes,
 * even seq). Container picks it up on next poll (~1s). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'FYI for your context — no action needed. The Refinery Class Attendance feature ' +
  'T-Herm spec\'d is BUILT and live (branch feature/class-attendance, not yet merged to main).\n\n' +
  'Tablet board: staff pick a class + date, tap resident photo cards for who is present, hit ' +
  'Save → it creates the Salesforce child Class Campaign + a CampaignMember per In-Program ' +
  'resident (tapped = Attended, rest = No Show), preserving the Campaign/CampaignMember model ' +
  'so the Classes dashboard and reporting still work.\n\n' +
  'New Resident Staff role: can take attendance but NOT edit past classes (locked to that one ' +
  'page); ED/PD can edit any class. Create + edit both verified against Salesforce on ' +
  'self-cleaning test sessions.\n\n' +
  'Bonus: resident profile photos are now thumbnailed (sharp, ~99% smaller) so the dashboards, ' +
  'Resident 360, drug-screening and check-up pages load much faster.\n\n' +
  'Still to do: merge to main + create the Resident Staff user accounts. You are up to speed if ' +
  'Johnny asks. Reply here to confirm you have this.';

const dbPath = join(import.meta.dirname, '..', 'data', 'v2-sessions', AGENT_GROUP, SESSION, 'inbound.db');
const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');

const max = (db.prepare('SELECT MAX(seq) AS m FROM messages_in').get() as { m: number | null }).m ?? 0;
const seq = max % 2 === 0 ? max + 2 : max + 1;
const id = `notify-${Date.now()}:${AGENT_GROUP}`;
const content = JSON.stringify({ text, sender: 'system', senderId: 'system' });

db.prepare(
  `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, process_after, recurrence, series_id, trigger, source_session_id, on_wake)
   VALUES (@id, @seq, 'chat', @ts, 'pending', @platformId, @channel, NULL, @content, NULL, NULL, @id, 1, NULL, 0)`,
).run({ id, seq, ts: new Date().toISOString(), platformId: PLATFORM_ID, channel: CHANNEL, content });
db.close();

console.log(`Injected Class Attendance notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
