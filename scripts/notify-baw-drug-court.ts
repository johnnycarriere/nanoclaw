/**
 * notify-baw-drug-court.ts — one-off FYI to Baw about the new Refinery
 * "Drug Court" dashboard + its printable roster. Same inbound.db injection
 * pattern as notify-agent.ts (kind='chat', sender:system, EVEN seq for host
 * parity). Container picks it up on next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Refinery update (2026-06-29) — FYI, no action; just stay current if Johnny or staff ask.\n\n' +
  'New dashboard: DRUG COURT (/dashboard/drug-court, ED+PD), in the Program group right after In Program.\n\n' +
  '• It lists every current In-Program resident flagged for drug court (Salesforce In_Drug_Court__c = Yes). Live right now: 13 men = 5 Emergency + 8 Transitional.\n' +
  '• Housing filter: Emergency / Transitional / Combined — defaults to Combined (the whole list).\n' +
  '• A "report date" picker that just stamps the printed header (Report as of M/D/YYYY) — it does NOT filter the roster; the list is always the current In-Program men.\n' +
  '• PRINTABLE LIST: a "⎙ Printable list" button opens a clean roster in a new tab and pops the print dialog (just like the drug-screening test lists). CSV export is there too.\n\n' +
  'Net: staff can pull the drug-court roster by housing and print it in a couple clicks. Shipped on main (johnnycarriere/RefineryDashboards), commits 4ba16e0 + 0c663a5, HANDOFF updated (0d994c5). T-Herm has been synced too.\n\n' +
  'Reply here to confirm you have this.';

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
