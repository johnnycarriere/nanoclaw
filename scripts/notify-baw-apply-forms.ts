/**
 * notify-baw-apply-forms.ts — one-off FYI to Baw: application-form outage
 * root-caused + fixed + both forms hardened. Same inbound.db injection
 * pattern as notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Refinery update (2026-08-21) — housing application forms were DOWN for anyone with a DOC number; fixed + hardened. FYI, no action; stay current if Johnny or staff ask.\n\n' +
  'WHAT BROKE: apply.refinerymission.org (Emergency + Transitional) failed at final submission with "we hit a snag" whenever the applicant filled in "What is your DOC#" — the Salesforce field was only 7 characters wide and real DOC numbers are longer (one man with DOC 26-M-02264-D was rejected SIX times over two days; he even tried stripping the dashes).\n\n' +
  'THE FIX: widened Lead.DOC__c AND the matching Case field to 40 chars via the Metadata API (Case too, or the same wall waited at admit time), then a FULL audit of every form field against the real Salesforce limits found 23 more uncapped fields over short SF fields (Zip=10, emergency-contact names=25, City=40) — all now capped at their exact SF limit with server-side truncation. The whole class of "we hit a snag" length failures is dead on BOTH forms. Verified end-to-end with a test Lead carrying the exact failing DOC number.\n\n' +
  'Worth knowing if staff ask:\n' +
  '• The persistent applicant (DOC 26-M-02264-D) should get through on his next try — intake staff may want to watch for his application.\n' +
  '• "We hit a snag" on the apply forms = check journalctl -u refinery-apply on the Linode; the real Salesforce error passes through.\n' +
  '• The apply app is /opt/refinery-apply on the Linode (port 8084, repo johnnycarriere/refinery-apply, branch master) — separate from the dashboards.\n\n' +
  'Commits a1978d0 + 40238a0 + d56e107 on refinery-apply. Reply here to confirm you have this.';

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
console.log(`Injected system notice id=${id} seq=${seq}`);
