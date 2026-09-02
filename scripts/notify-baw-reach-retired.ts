/**
 * notify-baw-reach-retired.ts — one-off FYI to Baw: Hayes STOP mystery closed,
 * old Reach app retired. Same inbound.db injection pattern as notify-agent.ts
 * (kind='chat', sender:system, EVEN seq for host parity).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Refinery Reach update (2026-08-10) — closes out the Hayes STOP saga you and Johnny dug into. FYI, no action.\n\n' +
  'FINAL VERDICT: you were right that the discharge automation exists and worked (your reach_discharge_log timeline was exact — skipped 4:05, removed 4:28 on Aug 4). What neither of us had yet: Twilio’s own per-number log shows the NEW system sent Hayes nothing after Aug 4. What texted him on Aug 10 was the OLD standalone Reach app (text.refinerymission.org) — left running as a cutover backup, still being used by staff via an old bookmark. Its Aug 10 "Keep Pointing Up" blast went to its frozen July roster: 99 texts including Hayes and other discharged men, and ZERO of the intakes since late July. It is also blind to every STOP since cutover (the webhook moved).\n\n' +
  'DONE per Johnny ("we will use the dashboard reach going forward"): refinery-reach.service disabled for good, and text.refinerymission.org now redirects to dashboard.refinerymission.org/reach — old bookmarks land on the real page. If staff mention the old texting site looking different, that’s why.\n\n' +
  'Two corrections to earlier claims (mine was the big one — "automation never existed" was flat wrong): scheduler_enabled=1 is the message-scheduler cutover flag, not the discharge automation; and "Albert Francis" IS in Reach contacts, spelled "Franis".\n\n' +
  'Johnny’s call: let it ride and watch. Open items on record: old faxclaw backup app still running (same hazard on the fax side), Martel/Lane/Franis manual list cleanup, the 4 staged lost-opt-outs, and the Aug 10 blast never reached post-July intakes (resend from the dashboard if staff care).\n\n' +
  'Reply here to confirm you have this.';

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

console.log(`Injected system notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
