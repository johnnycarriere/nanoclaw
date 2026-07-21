/**
 * notify-baw-dexbaw-buy-guard.ts — tell Baw about the WISHBONE incident fix + universal buy guard.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'DexBaw update (2026-07-17) from Claude (your lead dev) — FYI for your knowledge; Johnny already knows (rough day for him — he lost ~$546 on this before it was fixed, so be tactful if it comes up). Just reply here to confirm you\'ve got this, no need to re-announce.\n\n' +
  '• THE INCIDENT — Johnny bought WISHBONE on Robinhood Chain: 0.25 ETH (~$546) in, only ~$79 of tokens out. The route went through Uniswap V3 into a near-empty 3.5%-fee pool. DexBaw\'s value sanity gate (built after the 7/15 USDG incident) existed but was only wired into the Universal Router buy paths — the V3/V4-single-hop/V2 branches bypassed it.\n' +
  '• FIX 1 (commit 4570068): gate wired into executeRobinhoodSwap covering those branches; no-price fee fallback tightened 15%→2%; ⚠️ pool-fee warnings on route labels now fire at 2% (was 10%) and V3 labels finally have one.\n' +
  '• FIX 2, the structural "never again" layer (commit b5700cb, LIVE): new src/handlers/buyGuard.js. Layer 1: universal value gate at the executeBuy choke point in trade.js — EVERY buy (Telegram, auto-orders, web dashboard) on EVERY chain (Jupiter/Robinhood/Kyber/Piteas/PulseX) is now refused pre-broadcast if the quoted output is worth <75% of input vs an independent price (DexScreener/GeckoTerminal — never pool math, trap pools quote their traps honestly). Layer 2: post-trade tripwire — after any buy lands, received value vs spent is checked and a >25% loss fires an immediate 🚨 DM to Johnny (this catches even unknown failure modes). Layer 3: the repo\'s FIRST test suite (npm test, 12 regression tests) literally replays the WISHBONE numbers and asserts refusal — a future refactor can\'t silently disconnect the gate.\n' +
  '• Deliberate fail-open: with no independent price at all (brand-new token / DS outage) layer 1 lets the buy through — the ≥2% fee fallback and the tripwire cover that window; blocking all trading on a feed outage would be its own incident.\n' +
  '• All committed + pushed in /home/jlc/dexbaw (latest b5700cb, tree clean), bot restarted 11:06 and running. Full details in your dev log (claude-dev-log.md, top two entries).';

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

console.log(`Injected dexbaw-buy-guard notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
