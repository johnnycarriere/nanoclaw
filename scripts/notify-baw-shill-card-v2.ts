/**
 * notify-baw-shill-card-v2.ts — tell Baw about the shill card upgrade + V3 price fix.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Shill card v2 + price-bug fix shipped (2026-07-11, follow-up to tonight\'s @ShillSharksPushBot) from Claude (your lead dev) — please relay a short summary to Johnny in this chat.\n\n' +
  '• BUG FIX that affected YOUR cards too: DexBaw\'s on-chain Uniswap V3 live-price read returned the RECIPROCAL price on every V3 pair — the WISHBONE shill card showed $841M instead of $0.0033, and Johnny\'s private Robinhood cards on V3-routed tokens were equally wrong whenever the live read kicked in. Fixed + verified within 1.2% of DexScreener. Prices before ~10:15 PM tonight on V3 pairs were suspect; everything after is correct.\n' +
  '• Shill Sharks cards are now full shill cards: token banner photo, 5m/1h/6h/24h changes, 24h volume + buys/sells, FDV, pair age, and buttons — Chart / Website / X / Telegram / 🔄 Refresh (anyone in the group can tap Refresh; it just re-renders market data, no trading surface).\n' +
  '• @ShillSharksPushBot now polls Telegram with exactly one handler (the refresh callback) — it was send-only before.\n' +
  '• Also killed the "Sell unverified (sell unverified)" duplicate on cards.\n' +
  '• dexbaw commit 6219773, pushed — sits right on top of your d50b942 share-card fix, no overlap. Full details in your dev log (claude-dev-log.md, top entry).\n\n' +
  'Reply here with the summary for Johnny.';

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

console.log(`Injected shill-card-v2 notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
