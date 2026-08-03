/**
 * notify-baw-comms-migration.ts — one-off FYI to Baw about the Calculator /
 * Reach SMS / Fax migration into the dashboards, and the completed inbound
 * cutover (2026-07-28). Same inbound.db injection pattern as
 * notify-agent.ts (kind='chat', sender:system, EVEN seq for host parity).
 * Container picks it up on next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Refinery update (2026-07-28) — FYI, no action; stay current if Johnny or staff ask. THREE apps moved INTO the staff dashboard and the phone-number cutover is DONE (commits 06cf467 → a2d7ebe on main):\n\n' +
  '1) REFINERY CALCULATOR — /calculator (sidebar under Money). Square fee reverse-calc: staff type what they need to NET, it shows what to charge (swipe 2.60%+$0.10, keyed 3.50%+$0.15), Copy Total copies the bare number. Gear → Fee Presets lets them edit/add/delete rates, saved per device.\n\n' +
  '2) REFINERY REACH — /reach (new Communications sidebar group). The whole texting platform from text.refinerymission.org: compose to whole lists OR hand-picked people, templates, picture/MMS, send now or schedule; contacts (all 106), lists, templates, scheduled queue, sent log, plus a NEW inbound log. Two things to know: staff can now schedule a text to ONE PERSON (the old app was lists-only), and inbound texts are recorded + emailed to staff instead of vanishing.\n\n' +
  '3) REFINERY FAX — /fax. Send (contact picker or typed number; PDF/TIFF/JPG/PNG up to 20MB), outbox, inbox, contacts, log, settings, and a printable Transmission Confirmation page per fax for proving delivery to a pharmacy/agency.\n\n' +
  '⚠️ CUTOVER IS LIVE: texting 337-227-9365 and faxing 337-483-1035 now land in the DASHBOARD, not the old apps. text.refinerymission.org and fax.refinerymission.org still RUN as read-only backups on their own separate databases — anything entered after today exists only in the dashboard copies. Revert if ever needed: `bash /root/finish-cutover.sh --revert` on the Linode.\n\n' +
  'Verified with real traffic: Johnny sent a text to 2 hand-picked people (2 sent / 0 failed) and two faxes that delivered. If staff report a FAILED fax, the outbox now explains it in plain English — "That number isn’t in service" etc. Today’s failures were a wrong destination number, not the system.\n\n' +
  'Two things worth knowing if they come up: (a) six residents texted STOP months ago and the OLD app never recorded it (its webhook was unreachable), so they still show ACTIVE — nobody was actually texted, Twilio blocks opted-out numbers itself, and the fix is staged at scripts/ops/apply-lost-stops.js for Johnny to run. (b) The pharmacy report’s Reach phone lookup now reads the dashboard’s own copy of the Reach data, so retiring the old app won’t break the pharmacy PDFs. Nothing changed about your brief endpoint or any API you curl. Reply here to confirm you have this.';

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
