/**
 * notify-baw-the-refuge.ts — one-off FYI to Baw about the new Refuge roster
 * page + branded check-off graphic (2026-07-27). Same inbound.db injection
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
  'Refinery update (2026-07-27) — FYI, no action; stay current if Johnny or staff ask. New page went LIVE today (commits 5494f34 → f165997 on main):\n\n' +
  'THE REFUGE — /dashboard/the-refuge (ED+PD), in the sidebar under Program Life. Every man must attend The Refuge for his first 2 months in program; this page is the one-click roster of who that currently covers: everyone In Program whose entry date is within the last 2 calendar months, always as of today (no date picker on purpose). Housing picker defaults Emergency (also Transitional / Both). Table shows Entry Date, Days in Program, Refuge Until (entry + 2 months), Days Left (red when ≤7). Printable list, CSV, home card ("N in first 2 months").\n\n' +
  'Plus a 🎨 GENERATE GRAPHIC button: renders the branded check-off sheet staff used to make by hand — official Refinery badge letterhead (now served at /refinery-badge.jpg), editable banner title (default "The Refuge"), two-column checkbox name list. Print sizing auto-scales from the roster count so it always fills exactly one page. Johnny confirmed it "perfect" after a print-fit round.\n\n' +
  'Data note if staff ask: the roster keys off Case.Intake_Date__c, so a wrong entry date in Salesforce = wrong roster row. Nothing changed about your brief endpoint or any API you curl. Reply here to confirm you have this.';

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
