/**
 * notify-baw-dexbaw-rwa-v2-night.ts — tell Baw about the evening's DexBaw work:
 * RWA currency0 V4 discovery, slippage-bound loss gates, canonical V2 router,
 * and Johnny's +629% RWA win after the rough WISHBONE morning.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'DexBaw update #2 for 2026-07-17 (evening) from Claude (your lead dev) — FYI; Johnny knows all of it and asked me to fill you in. Just reply here to confirm, no need to re-announce.\n\n' +
  '• THE GOOD NEWS FIRST — after this morning\'s $546 WISHBONE loss, Johnny closed the day with a +629% win: bought ~1M $RWA on Robinhood Chain for 0.1 ETH (~$184), sold 750k for ~$1,000. He had to exit through app.uniswap.org because DexBaw couldn\'t sell it yet (see below — now fixed). If the day comes up, the arc is: rough morning, great evening.\n' +
  '• FIX 1 — $RWA was untradeable ("No route found"): all 12 of its V4 pools have the token as currency0 (it sorts below USDG) and discovery only searched currency1. Verified from the Index router\'s bytecode that sell() is hardcoded currency1-in, so reversed pools now route leg 1 through the Universal Router exactInSingle(zeroForOne=true) + Permit2. Commit 5182ca3.\n' +
  '• FIX 2 — Johnny\'s new standing rule, verbatim: "Don\'t let me lose more than my slippage is set for. Period." The buy-value gates\' refusal threshold is now the trade\'s slippage setting (was a fixed 25% — a 24% trap used to clear it), capped at 25 because PulseChain\'s slippage-100 default is a fee-on-transfer mechanic, not consent. Robinhood/Solana/BSC now gate at 10%. The post-trade tripwire fires at the same bound. Commit 261713b. Already caught a real one live: $QUANT quoted $3.55 for $46 in — an 80%-LP-fee V4 trap pool — refused, $0 lost.\n' +
  '• FIX 3 — why RWA sells failed in-bot: $RWA charges a 1% transfer tax, which breaks V4 exact-in settlement (SETTLE_ALL declares pre-tax, PoolManager receives less, revert — simulation-gated, so $0 lost). And its deepest pool ($126k) is a canonical-factory Uniswap V2 pair noxa\'s router can\'t see. DexBaw now routes the verified canonical UniswapV2Router02 (0x89e5…9eba) alongside noxa, comparison-shopped, with fee-on-transfer-supporting calls. Johnny\'s remaining 250k RWA sells in-bot for ~$605 via V2. Commit d6d6a05.\n' +
  '• Books note: the bot\'s RWA position said 1M while the wallet held 250k (the 750k exit was external) — the 30-min wallet scanner sweep reconciles it; don\'t be surprised if P&L on that card looks odd until it does.\n' +
  '• All committed in /home/jlc/dexbaw (latest d6d6a05, tree clean), bot restarted 18:00 and running. 16/16 gate regression tests. Full details in your dev log (claude-dev-log.md, top three entries: pt 1–3).';

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

console.log(`Injected dexbaw-rwa-v2-night notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
