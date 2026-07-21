/**
 * One-off: tell Baw De Claw the Refinery Guest Contribution Hub is done.
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
  'FYI for your context — no action needed. The Refinery **Guest Contribution Hub** is BUILT and live ' +
  '(dashboard.refinerymission.org/guest-contributions), and it is now in your CLAUDE.local.md under ' +
  '"Refinery Dashboards → Hubs".\n\n' +
  'It is a fast data-entry tool (ED + PD) modeled on the Drug Screen recorder: a photo card per current ' +
  'In-Program resident with Type · Amount · Comment, a shared Date Paid (defaults today), a ' +
  'Combined/Emergency/Transitional filter and list/card views. Saving creates Salesforce ' +
  'Guest_Contribution__c records and auto-links the resident\'s Contact (names always match). ' +
  'Type defaults to SNAP, and a "set all type to" toggle flips every card SNAP↔Rent at once.\n\n' +
  'Note: the dashboards are no longer purely read-only — Class Attendance, the Drug Screening Hub, ' +
  'Weekly Check-Up and now this hub all write specific Salesforce objects via sanctioned paths. ' +
  'Johnny confirmed the Guest Contribution Hub working end-to-end on 2026-06-30. You are up to speed ' +
  'if he asks. Reply here to confirm you have this.';

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

console.log(`Injected Guest Contribution Hub notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
