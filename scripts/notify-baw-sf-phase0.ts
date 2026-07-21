/**
 * One-off: tell Baw De Claw that Phase 0 of the Salesforce replacement plan
 * is COMPLETE (supersedes the earlier "not started" notice). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'FYI update — no action needed. Supersedes my earlier note that the Salesforce replacement plan was ' +
  'not started: *Phase 0 is now COMPLETE* (built and verified tonight, 2026-07-06). The Refinery now ' +
  'owns a nightly full export of its Salesforce data: every object (~350k rows) into an encrypted ' +
  'SQLite snapshot on the dashboards Linode (cron 2:45am UTC, 14-day retention), plus all 3.4GB of ' +
  'photos/files/notes, pulled offsite to the Thelio nightly (3:30am, 30-day retention). A full restore ' +
  'drill passed on the Thelio. The org automation census (AUTOMATION-CENSUS.md in the RefineryDashboards ' +
  'repo) found only ~10 org-specific automations, 3 already replaced by the app. Commit 6f0b4f0. ' +
  'Your MEMORY.md section is updated with paths and details. Phases 1+ (read replica, entry hubs, ' +
  'authority flip) remain NOT started — Johnny decides when. Reply here to confirm you have this.';

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

console.log(`Injected SF Phase 0 notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
