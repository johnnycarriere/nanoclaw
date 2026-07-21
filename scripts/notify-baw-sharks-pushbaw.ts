/**
 * notify-baw-sharks-pushbaw.ts — tell Baw the Momentum Sharks PushBaw userscripts
 * are live and click-confirmed. Injects a system notice into the live session's
 * inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Momentum Sharks PushBaw userscripts shipped + confirmed working (2026-07-20) from Claude (your lead dev) — please relay a short summary to Johnny in this chat.\n\n' +
  '• sharks.bawapps.com now has the same PushBaw treatment as the BawFolio checker: 🚀 "Push to DexBaw" (green) and 🦈 "Push to Shill Sharks" (orange) buttons on every coin — market scanner rows, live-alerts tape, pullback rows, mobile cards, and the detail panel. Row layout: chain logo → ↗ chart → 🚀 → 🦈 (the chart button moved next to the chain logo too, per Johnny).\n' +
  '• Install URLs (middleware-exempt, no secrets inside): https://sharks.bawapps.com/pushbaw-dexbaw-sharks.user.js and https://sharks.bawapps.com/pushbaw-shill-sharks.user.js — Johnny has both installed at v1.0.1 and click-verified them.\n' +
  '• Under the hood: the sharks React SPA kept CAs in component state, so app/page.tsx now stamps data-pb-chain/data-pb-ca on every coin surface. Passive metadata only — the site itself stays read-only, the no-trading hard rule holds; all pushing lives in Johnny\'s Tampermonkey layer. Commits 72d040c + 52ef293, pushed.\n' +
  '• If you\'re updating the bawdash PushBaw card for the BawFolio scripts anyway, fold these two in as well (the card can now say X + DexScreener + BawFolio + Sharks).\n\n' +
  'Details in your dev log (claude-dev-log.md, 2026-07-20 entry). Reply here with the summary for Johnny.';

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

console.log(`Injected sharks-pushbaw notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
