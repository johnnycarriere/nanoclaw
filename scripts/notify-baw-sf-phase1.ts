/**
 * One-off: give Baw De Claw the full end-of-night state of the Salesforce
 * replacement work (Phase 0 + Phase 1a + Phase 1b batch 1) so he can brief
 * Johnny at the office tomorrow. Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Full end-of-night briefing from Claude — Johnny will pick this work back up at the office tomorrow ' +
  'and may ask you where things stand. This supersedes my earlier notes tonight. Your MEMORY.md section ' +
  '"Refinery Salesforce Replacement Plan" has all details/paths.\n\n' +
  '*WHERE THINGS STAND (2026-07-06 night, commits 6f0b4f0 → 872d4e7 → 416586d on RefineryDashboards):*\n\n' +
  '*Phase 0 — COMPLETE.* Nightly full Salesforce export (20 objects, ~350k rows, all fields) to an ' +
  'encrypted SQLite snapshot on the dashboards Linode, plus 3.4GB of photos/files/notes. Cron 2:45am UTC, ' +
  '14-day retention. Thelio pulls it offsite nightly at 3:30am Central (30-day retention) and holds its own ' +
  'decryption key. A full restore drill PASSED on the Thelio. Automation census committed ' +
  '(AUTOMATION-CENSUS.md): only ~10 org-specific automations, 3 already replaced by the app.\n\n' +
  '*Phase 1 — LIVE, 4 of ~15 dashboards flipped.* A local read replica (data/replica/refinery.db) syncs ' +
  'from Salesforce every 5 minutes (scripts/sf-sync.js, cron+flock, log /var/log/sf-sync.log). ' +
  '*Classes, Drug Court, Write-Ups, and Requests now serve from the replica* — each was proven ' +
  'byte-identical to its live-SOQL version by scripts/diff-dashboard.js before its flag went live, and ' +
  'they load 10–25x faster. If the sync ever goes stale >30 min, dashboards auto-fall-back to live ' +
  'Salesforce (tested for real). Nightly reseed from the export = full reconcile.\n\n' +
  '*Key technical lesson:* cross-object formula fields (like Case.Date_of_Last_Drug_Test__c) go stale in ' +
  'a replica because child writes never touch the parent row — the fix is computing them from the child ' +
  'tables (drug-court does this now; matters again when drug-screening reads flip).\n\n' +
  '*TONIGHT (overnight): the first fully automated cycle runs* — 2:45am UTC backup+reseed on the Linode, ' +
  '3:30am Central pull on the Thelio. If Johnny asks tomorrow whether it worked, check ' +
  '/var/log/backup-sf-export.log and /var/log/sf-sync.log on the Linode (ssh -p 2222 root@45.79.40.41) ' +
  'and ~/backups/refinery-sf/pull.log on the Thelio — you have SSH to both.\n\n' +
  '*NEXT (when Johnny picks up with Claude): Phase 1b batch 2* — flip the remaining ~11 dashboard loaders ' +
  '(census, intake, employment, discharge, at-risk, outcomes, donations, campaigns, GC/SNAP audits, home ' +
  'summaries) + a sync health page. The flip pattern is documented in HANDOFF.md; the simple ones take ' +
  '~10 min each. Phases 2 (in-app intake/donations/notes entry — the "staff never open Salesforce" ' +
  'milestone) and 3 (authority flip) remain not started; Johnny decides.\n\n' +
  'Reply here to confirm you have this, and be ready to give Johnny a tight status summary tomorrow if he asks.';

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

console.log(`Injected SF phase-1 briefing id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
