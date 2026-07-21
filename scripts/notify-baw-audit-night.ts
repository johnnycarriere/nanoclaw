/**
 * notify-baw-audit-night.ts — brief Baw on the 2026-07-13/14 overnight session:
 * DexBaw Codex-audit remediation + 4 upgrades + Robinhood V4 discovery/two-hop,
 * and the BawFolio checker honeypot-hiding fix. Same inbound.db injection
 * pattern as notify-agent.ts (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Overnight briefing (2026-07-13/14) from Claude (your lead dev) — big DexBaw + BawFolio night. Six new entries in your dev log (claude-dev-log.md, from "Codex audit" onward) — read them before touching either repo. TL;DR:\n\n' +
  '• DEXBAW AUDIT: Johnny brought an external Codex audit; all 14 findings verified real and FIXED (41a656b). Biggest behavior changes: order fires are now FAIL-CLOSED everywhere (no cached-balance fallbacks, limit checks re-arm on unreadable data), pre-broadcast trade errors RE-ARM instead of terminal-failing (an SL survives RPC outages), and wallet identity is pinned through every background loop. applyTransferOut now scales spent+gas+REALIZED (pnlPct invariant — run scripts/test-transfer-books.js if you touch books math).\n' +
  '• DEXBAW UPGRADES SHIPPED: #1 tx journal + boot reconciliation (a47c77d) — EVERY new trade path must journalIntent → submit-wrapper → pass journalId into applyTradeAndRecord; #2 standalone alerts (2d62a63, /alerts, prefixes alw/alz/alx/alr); #3 /risk dashboard (03e2b94); #4 rug guard (d2608d3, /guard, guard_state table, pure evalFast/DeepSignals — keep test-guard.js green). Upgrade #5 (retry policy) DECLINED by Johnny — do not build retry knobs.\n' +
  '• ROBINHOOD V4: lazy pool discovery restored (6771306) + two-hop USDG sells (51b22a5) — stock/RWA tokens (AAPL, MSFT, USAR…) sell now. Load-bearing gotchas: Alchemy free tier caps eth_getLogs to 10 BLOCKS on RH chain (use the public defaultRpc for any log scan); pool ranking must be by QUOTE OUTPUT not liquidity (USAR\'s only venues charge 90%/95% LP fees — the DS-listed pair IS the 90% pool, route labels warn ⚠️); RWA tokens use ERC-7201 OZ-v5 namespaced storage (classic allowance-slot scans fail in eth_call sims). Buys of USDG-paired tokens are NOT supported (router buy() is native-in).\n' +
  '• BAWFOLIO: the checker was hiding real tokens as "likely honeypots" (Johnny\'s $2.7k INDEX vanished) — DexScreener under load returns prices WITHOUT the liquidity object, and liq==null hit the honeypot branch. Fixed in b20eb82 (deployed): price-with-no-depth renders unpriced, degraded reads never overwrite good cache, and GeckoTerminal DOES index Robinhood (network id "robinhood", page 3 — your "not indexed" note only checked page 1). Owner scan went $2,172 → $4,824. Invariants if you touch pricing.js: degraded reads never overwrite good cache; liq==null never reaches isSuspicious with value>0.\n\n' +
  'Everything is committed and pushed on both repos (dexbaw main = 51b22a5, bawfolio main = b20eb82); the bots/services are deployed and verified live. Reply here to confirm you\'ve got this.';

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
).run({
  id,
  seq,
  ts: new Date().toISOString(),
  platformId: PLATFORM_ID,
  channel: CHANNEL,
  content,
});
db.close();

console.log(`Injected system notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
