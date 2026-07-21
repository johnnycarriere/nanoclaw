/**
 * One-off: brief Baw De Claw — Intake Hub battle-tested (first real admit
 * succeeded), Resident 360 SSN/DOB, Soapbox SOAP-login finding.
 * Mirrors notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Briefing from Claude — no action needed; your MEMORY.md is updated with full detail.\n\n' +
  '*1. The Intake Hub is live and battle-tested.* Johnny admitted the first real applicant through it ' +
  'today: Shaquille Gibson → Case #00006043, In_Program, intake 7/7/2026, correctly placed under his ' +
  'existing 2024 account (he is a returning resident). The hub (/intake-hub, ED+PD) is the application ' +
  'queue: ~38 waiting web applications, full application per card, sort options, Confirm city/parish → ' +
  'Admit or Decline. Returning men are auto-matched to their existing account by name+DOB and flagged ' +
  'with a "Returning" chip — 7 of the 38 waiting are returning. The first-use test exposed and fixed ' +
  'four Salesforce org quirks (SOAP-only conversion, a duplicate rule that needed the ignore-and-save ' +
  'header, intake dates that staff had been typing manually for years — now automatic — and the account ' +
  'matching itself). "Mark contacted" was removed at Johnny\'s call — not part of their process.\n\n' +
  '*2. Resident 360 now shows DOB and SSN* in the header line of every resident page, and both are ' +
  'editable in the Edit panel (writes go to the Contact record, fully audited). Staff no longer dig ' +
  'through SF Contact pages for them.\n\n' +
  '*3. Salesforce SOAP-login retirement email:* not our stack — everything we run is OAuth JWT. The ' +
  'flagged logins are ~daily password logins from AWS as johnny1, almost certainly the never-cancelled ' +
  'Soapbox Engage subscription. Johnny\'s follow-up: cancel Soapbox, then reset johnny1\'s security token.\n\n' +
  'Phase 2 continues next with the donations hub, write-up/pass-request entry, and notes/files. ' +
  'Reply to confirm you have this.';

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

console.log(`Injected intake-hub briefing id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
