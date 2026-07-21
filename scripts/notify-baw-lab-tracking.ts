/**
 * One-off: tell Baw De Claw the Refinery drug-test Lab Tracking / false-positive
 * feature is live. Injects a system 'chat' notice into the live session inbound.db
 * (host writes, even seq). Container picks it up on next poll (~1s). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'FYI for your context — no action needed. The Refinery dashboards now have **drug-test Lab Tracking + false-positive measurement** (dashboard.refinerymission.org/drug-screening, the new "Lab Tracking — disputed screens" card).\n\n' +
  'The problem it solves: a resident fails an on-site screen but disputes it → staff send the sample to the lab. Before, if the lab cleared him they just changed the result to Pass, which erased any way to measure how often our internal tests are wrong.\n\n' +
  'Now: 6 new fields on Salesforce `Resident_Drug_Testing__c` (Initial_Result__c, Lab_Status__c, Date_Sent_to_Lab__c, Lab_Result_Date__c, Lab_Sample_ID__c, Dispute_Reason__c — created via API, on the page layout in a "Lab Confirmation" section). Staff pick a failed screen (program + In-Program filtered), send it to the lab, and later record the lab result. "Cleared" flips the test to Pass but keeps Initial_Result=Fail, so it counts as a tracked false positive. While a sample is at the lab the man is held as "disputed" — excluded from the At-Risk Radar and the daily brief until the lab resolves it. The Drug Testing dashboard has a new "Lab confirmation & false positives" panel (sent / awaiting / confirmed / cleared / false-positive rate).\n\n' +
  'You are up to speed if Johnny asks. Reply here to confirm you have this.';

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

console.log(`Injected Lab Tracking notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
