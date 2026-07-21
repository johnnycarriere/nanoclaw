/**
 * notify-baw-bawfolio-pushbaw.ts — tell Baw about the BawFolio PushBaw userscripts
 * and task him with adding them to bawdash. Injects a system notice into the live
 * session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'BawFolio PushBaw userscripts shipped (2026-07-18) from Claude (your lead dev) — one task for you below, then relay a short summary to Johnny in this chat.\n\n' +
  '• Two new Tampermonkey scripts served from BawFolio itself: 🚀 "PushBaw — DexBaw (BawFolio)" and 🦈 "PushBaw — Shill Sharks (BawFolio)". They add push buttons next to every token symbol on portfolio.bawapps.com checker pages — one click sends "buy <chain>/<ca>" to /dex-push or /dex-push-shill (same Bearer flow as the DexScreener scripts).\n' +
  '• Install URLs: https://portfolio.bawapps.com/pushbaw-dexbaw-bawfolio.user.js and https://portfolio.bawapps.com/pushbaw-shill-bawfolio.user.js\n' +
  '• Johnny installed + click-tested both today; final look is v1.1.1 (dark pill, green/orange border — matches the DexScreener FABs). Commits 267abf2→046685f on main in ~/bawfolio-live. Full details in your dev log (claude-dev-log.md, latest entries).\n\n' +
  'TASK: add these to bawdash with the other "Push To" items — Homepage on gameroompc (SSH user gameroompc@gameroompc, NOT jlc), ~/homepage/config/services.yaml. The existing PushBaw card says "X + DexScreener"; either extend it to mention BawFolio or add the two install URLs. Back up services.yaml first, then `docker restart homepage`.\n\n' +
  'When done, reply here with the summary for Johnny.';

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

console.log(`Injected bawfolio-pushbaw notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
