/**
 * notify-baw-first-wave.ts — one-off FYI to Baw about the Refinery Dashboards
 * "first wave" feature drop (2026-07-25). Same inbound.db injection pattern as
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
  'Refinery update (2026-07-25) — FYI, no action; stay current if Johnny or staff ask. Five new features went LIVE today ("first wave" from a UI/UX audit, commits a46076e + 17decf6 on main):\n\n' +
  '1. QUICK ACTIONS on Resident 360 — buttons for New Write-Up / Pass Request / Behavioral Agreement / Drug Test / Record Payment that jump to the right hub with THAT resident already selected (no more re-finding him in the 110-man dropdown).\n\n' +
  '2. UNSAVED-ENTRY GUARD — every batch hub (check-ups, contributions, drug screening, class attendance, write-ups, donations, edit panel) now confirms before leaving the page with unsaved entries. If staff mention a new "leave without saving?" dialog, that is this feature working, not a bug.\n\n' +
  '3. GUIDED DISCHARGE — new "🚪 Discharge…" button on Resident 360: date + reason (real SF picklist) + type + destination, optional exit note + checklist saved to his record, everything audited and every dashboard refreshed. This replaces flipping Status inside the big edit panel. ⚠️ Johnny has NOT yet done the first real discharge — validation guards are verified live, the write itself awaits his click-test.\n\n' +
  '4. STAFF ACTIVITY page — /staff-activity (ED-only, in the sidebar): who did what, when — drug screens, write-ups, edits, intake, attendance, donations — filter by staff member and 7/30/90 days, times in Central.\n\n' +
  '5. SMALL WINS — "Unrated only" filter on the Weekly Check-Up page (Friday catch-up is much faster), "/" or Ctrl+K focuses the resident search from anywhere, and a unified status color system under the hood.\n\n' +
  'Nothing changed about your brief endpoint, checkup-status endpoint, or any API you curl. Reply here to confirm you have this.';

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
