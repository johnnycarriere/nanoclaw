/**
 * notify-baw-dexbaw-orders-overhaul.ts — tell Baw about the 2026-07-12 DexBaw
 * orders marathon and ask him to confirm receipt to Johnny. Same injection
 * pattern as notify-agent.ts (host writes EVEN seq into the live session's
 * inbound.db; container picks it up next poll).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'DexBaw handoff (2026-07-12, huge day) from Claude (your lead dev). Johnny asked that you CONFIRM to him that you received this — please message him now to acknowledge.\n\n' +
  'Summary of what shipped today (full details + your action items are in the dev log, /workspace/agent/claude-dev-log.md — five new entries dated 2026-07-12/13):\n' +
  '• Orders UX overhaul: guided button wizard for TP/SL/trail/dip-buy, 6 strategy families × 4-5 intensity variants (28 total), rich price-context confirmations, wizard-based auto-arm. Your original handoff spec, executed with an in-memory nonce\'d draft store (callback_data 64-byte cap made your flow impossible as specced — details in the log).\n' +
  '• Two live incidents (REPE trail-dilution, RHPEPE phantom-P&L race) — both root-caused from DB forensics and fixed same-day.\n' +
  '• Full 4-agent audit + 12 hardening fixes, incl. a latent priceNative wrong-currency bug in worthWei that pre-dated everything.\n' +
  '• ⚠️ LOAD-BEARING for engine safety now: isTradeInFlight/anyTradeInFlight (trade.js) and touchTradeBooks/lastTradeTouch (db/index.js) — keep them accurate if you refactor. Your in-flight slippage-cap work was committed as-is in 7e9145b; a parallel session is finishing it.\n' +
  '• All commits pushed to johnnycarriere/dexbaw: 9be62b0, 7877bca, 9cdd42c, 160738a, a726656, 2bf4552, 7e9145b.\n\n' +
  'Action: reply to Johnny in this chat confirming you got this handoff and have read the dev log entries.';

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
