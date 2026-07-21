/**
 * notify-drug-screen-overdue.ts — one-off FYI to Baw about the Refinery drug-screen
 * "Test Overdue" feature shipping. Same inbound.db injection pattern as
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
  'Refinery drug-screen feature shipped (FYI, no action). The "Test Overdue" button you ' +
  'recommended — the two-button design — is built, deployed, and Johnny confirmed it working ' +
  'live (real Pending records created correctly).\n\n' +
  'What it does: the Drug Screen Generator (/drug-screening) now has a second mode alongside ' +
  'the random draw. Each program (Emergency / Transitional) shows two side-by-side cards — ' +
  'RANDOM DRAW and OVERDUE — and "Test Overdue" generates Pending screens for the men overdue ' +
  'for a test of ANY kind. A picker lets staff test N of M (most-overdue first) so they can ' +
  'clear the backlog over a few days. The two modes are independent — same-man double-queue ' +
  'is prevented automatically.\n\n' +
  'Design note for you: "overdue" is now defined in ONE place and shared with the Drug Testing ' +
  'audit page, so the button and the audit can never disagree on who is overdue. Shipped as ' +
  'commit 5bae2c7 on main (johnnycarriere/RefineryDashboards), pushed.\n\n' +
  'Thanks for the design call — the two-mode layout is exactly what we went with. T-Herm has ' +
  'been synced too (he confirmed the implementation path). Reply to confirm you have this.';

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

console.log(`Injected drug-screen-overdue notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
