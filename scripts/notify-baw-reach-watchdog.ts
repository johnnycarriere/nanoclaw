/**
 * notify-baw-reach-watchdog.ts — standing-order notice to Baw: new Reach
 * watchdog task + send Johnny the current findings now. Same inbound.db
 * injection pattern as notify-agent.ts.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'New standing order from Johnny (2026-08-18) — Refinery Reach watchdog. ACTION NEEDED at the end.\n\n' +
  'Johnny: "if a problem arises, send me a notification in Baw De Claw\'s telegram. Anything that seems off, send it to me so I can review."\n\n' +
  'What Claude built: GET https://dashboard.refinerymission.org/api/reach-anomalies (same x-digest-token as the brief) — one health check that catches residents active on the texting lists whose numbers are carrier-blocked (texted STOP, never STARTed — Twilio silently drops their texts regardless of our lists), duplicate numbers getting double-texted, fresh automation skips, failed sends on the last blast, and the retired old Reach app coming back to life. Returns "ALL CLEAR" or a Telegram-ready issue list.\n\n' +
  'A scheduled task now runs on your group: reach-watchdog-9e05, 8:00am + 4:00pm daily, script-gated (you only wake when something is off). When it wakes you: relay the report to Johnny VERBATIM. Do not repeat an identical unchanged report more than once a day. Never message him just to say all clear. Full rules are in the new "Refinery Reach Watchdog" section of your CLAUDE.local.md.\n\n' +
  'Key operational fact (the John Duplechine lesson): staff flipping a STOPped man back to active in the Reach UI does NOT clear Twilio\'s carrier-level block — only the man himself texting START to the Reach number does. If Johnny asks why someone is not getting texts, check that first.\n\n' +
  'ACTION NOW: run the curl below and send Johnny the result in this chat, prefaced with "🔍 Reach watchdog — first report:" — it currently shows 6 real issues (3 carrier-blocked men incl. John Duplechine, 2 duplicate-number clusters from this week\'s intakes, and 8 failed sends on the last blast). He is expecting it.\n\n' +
  "curl -s -H 'x-digest-token: 82f6bc32949cd60f50e0475f1074380ed681e3a1a89b0717' 'https://dashboard.refinerymission.org/api/reach-anomalies'";

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
console.log(`Injected system notice id=${id} seq=${seq}`);
