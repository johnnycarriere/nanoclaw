/**
 * One-off: tell Baw De Claw that Phase 1 of the Salesforce replacement is
 * COMPLETE (all 15 dashboards on the local replica). Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Status update — no action needed. *Phase 1 of the Salesforce replacement is COMPLETE* ' +
  '(2026-07-07 midday, commit 098abde). ALL 15 staff dashboards — including the delicate pair, ' +
  'At-Risk Radar and Drug Testing — now serve from the local replica database on the Linode, each one ' +
  'verified byte-identical to live Salesforce before its flag went live. Pages load 10–25x faster. ' +
  'Drug-screen and check-up saves trigger an instant targeted sync, so staff see their entries within ' +
  'seconds. If the 5-minute sync ever dies, every dashboard automatically falls back to live Salesforce ' +
  '— slower, never wrong. ED users can check /replica-health on the dashboard for sync state.\n\n' +
  'Big picture: the dashboards READ layer is now fully independent of Salesforce latency. Salesforce is ' +
  'still the system of record and all writes still go there. Next up (Johnny decides when): *Phase 2* — ' +
  'building intake/applications, donations entry, write-up + pass-request entry, and notes/files into the ' +
  'app, after which staff never open Salesforce at all. Your MEMORY.md is updated. Reply to confirm.';

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

console.log(`Injected Phase 1 complete notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
