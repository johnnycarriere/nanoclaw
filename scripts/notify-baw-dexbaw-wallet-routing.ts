/**
 * notify-baw-dexbaw-wallet-routing.ts — tell Baw about the 2026-07-18 DexBaw
 * wallet-routing build day and have him send Johnny a wrap-up notification.
 * Same inbound.db injection pattern as notify-agent.ts (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'DexBaw update (2026-07-18) from Claude (your lead dev) — big wallet-privacy build day, all LIVE and pushed to github.com/johnnycarriere/dexbaw (00bd691..4d8d934). Johnny asked that you send him a notification summarizing the day\'s work — please DM him a short friendly wrap-up based on this (and keep it brief, he lived it):\n\n' +
  '• RECEIVE/RETURN WALLET ROUTING: each wallet can route buy outputs to another registered wallet and sell proceeds to a return address. Johnny\'s setup: ETH Wallet buys → tokens land in Holdings; Holdings sells → ETH returns to ETH Wallet. Purpose is PRIVACY — copy-traders watching one wallet lose the trail. Configure via /wallets → 🔁 Routing. Works on PulseX, Kyber (ETH/Base), Robinhood V2/V3/V4 single-hop + two-hop sells; bonding curves (pump.tires/four.meme), Universal-Router stock/RWA buys, and Solana can\'t route (contracts pay msg.sender — reply warns). Routed buys BOOK under the receive wallet; auto-arm is skipped on them; the receive wallet needs its own gas to sell (first live sell failed on 0 ETH until funded — error handling around that got fixed too, incl. a real NonceManager bug where a rejected send poisoned the next attempt with "nonce too high").\n' +
  '• /w QUICK-SWITCH: one-tap toggle between routing partners (ETH Wallet ⇄ Holdings); trade receipts carry 🔀 switch buttons so the buy→switch→sell loop never opens /wallets.\n' +
  '• /positions OVERHAUL: shows ALL wallets (grouped, active first) incl. native gas balances per chain (public-RPC reads — Alchemy rate-limiting was silently hiding 3 ETH), one "Trade on X" button per non-active wallet, cleaner glyphs. \n' +
  '• BOOKS: cost basis now TRAVELS on wallet-to-wallet /transfers (applyTransferIn); repaired today\'s stranded rows — WSB 0.45 / MOASS 0.25 / APES 0.15 ETH basis moved to Holdings, RKT cycle logged (+18.13%). P&L percentages are honest average-entry numbers now.\n\n' +
  'Verified live end-to-end by Johnny (routed buy → sell → ETH home). Full detail in your dev log (claude-dev-log.md, several 2026-07-18 entries). If you touch DexBaw wallets/positions/transfer code, read those first — and preserve the privacy intent in anything wallet-related. Now please send Johnny that wrap-up DM.';

const dbPath = join(
  import.meta.dirname,
  '..',
  'data',
  'v2-sessions',
  AGENT_GROUP,
  SESSION,
  'inbound.db',
);
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
console.log(`injected seq ${seq} into ${dbPath}`);
