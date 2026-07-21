/**
 * One-off: tell Baw De Claw about the approved (not started) Salesforce
 * replacement plan for the Refinery dashboards. Injects a system 'chat'
 * notice into the live session inbound.db (host writes, even seq).
 * Container picks it up on next poll (~1s). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'FYI for your context — no action needed, and IMPORTANT: nothing described here is built yet. ' +
  'Full details are now in your MEMORY.md under "Refinery Salesforce Replacement Plan".\n\n' +
  'On 2026-07-06 Johnny asked Claude to explore what it would take for the Refinery dashboards app to ' +
  'fully REPLACE Salesforce. Claude inventoried the whole SF footprint (17 objects read, 18 sanctioned ' +
  'write functions, only ~25-30k rows total — SQLite-class data) and Johnny approved a phased roadmap ' +
  'as information only. His calls: drivers are UX/control (not cost); Salesforce stays alive as a ' +
  'read+write synced safety-net mirror; rollout is strangler-style, gradual, reversible — never a ' +
  'big-bang cutover.\n\n' +
  'The phases: 0) foundations — nightly SF export + encrypted offsite backups + restore drill + audit ' +
  'of SF automations (likely first step); 1) local read replica (refinery.db), dashboards flip ' +
  'SOQL→SQL one at a time; 2) THE REAL PRIZE — build the missing entry surfaces (intake/applications, ' +
  'donations/donor hub, write-up + pass-request entry, notes/files) so staff never open Salesforce ' +
  'again while SF quietly stays system of record; 3) optionally flip authority later (local DB primary, ' +
  'writes mirrored to SF with reconciliation); 4) someday, SF becomes a cold archive.\n\n' +
  'If Johnny mentions "the Salesforce replacement", "the migration", or "Phase 0/1/2" — this is what he ' +
  'means. Current status: APPROVED PLAN, NOT STARTED, he picks the phase. Reply here to confirm you have this.';

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

console.log(`Injected SF replacement plan notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
