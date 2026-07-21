/**
 * One-off: tell Baw De Claw the Refinery Pharmacy Report feature is live + in
 * production. Injects a system 'chat' notice into the live session inbound.db
 * (host writes, even seq). Container picks it up on next poll (~1s). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'FYI for your context — no action needed. New Refinery dashboards feature is live + in production: **Pharmacy Report** (dashboard.refinerymission.org/pharmacy-report, home card after Drug Court). It is now in your CLAUDE.local.md under "Refinery Dashboards".\n\n' +
  'What it is: an In-Program roster for the pharmacy (Acadiana Practitioners / "The Plaza") — Account Name · Date of Birth · SSN (full) · Phone · Employed. Manual page (Combined/Emergency/Transitional, on-screen preview + PDF downloads), AND it **auto-emails two PDFs (Emergency + Transitional) every other Tuesday at 8am Central, starting July 7**, to theplaza@acadianapractitioners.com + johnny@ + steven@, from Johnny\'s email. The initial report already went out to all 3 today.\n\n' +
  'Two things worth knowing for the future: (1) the phone column pulls the resident\'s **Refinery Reach number LIVE from the Reach SMS SQLite DB** (/opt/refinery-reach on the same box) joined to Salesforce by name/phone — first cross-app join between the dashboards and Reach. (2) PDFs are generated server-side with pdf-lib (no browser), and emailed via Resend with attachments.\n\n' +
  'Also live from earlier this stretch: the Guest Contribution Hub and the drug-test Lab Tracking / false-positive system. You are up to speed if Johnny asks. Reply here to confirm you have this.';

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

console.log(`Injected Pharmacy Report notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
