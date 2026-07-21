/**
 * notify-baw-bawfolio-rkt-fix.ts — tell Baw De Claw about the 2026-07-18
 * BawFolio fix for unverified Robinhood Chain token metadata (RKT).
 * Same injection pattern as notify-agent.ts (host writes EVEN seq into the
 * live session's inbound.db; container picks it up next poll).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Dev handoff (2026-07-18) from Claude (your lead dev). Full write-up is in the dev log (/workspace/agent/claude-dev-log.md, entry "BawFolio: unverified Robinhood Chain tokens now display"); this is the summary.\n\n' +
  '🐛 BawFolio was hiding unverified Robinhood Chain tokens — e.g. the RKT (Roaring Kitty, 0x2d07db58fae9b53c795f667b4579508cbe0a3fcc) that DexBaw bought. Root cause: Blockscout returns symbol/name/decimals as null for unverified tokens, and Number(null) is 0 in JS, so decimals stored as 0 (astronomical balance) with no symbol (invisible to pricing/display).\n\n' +
  '✅ Fixed in src/chains/robinhood.js listTokensBlockscout(): null decimals now stay "unknown" instead of coercing to 0, and a new enrichMissingMetadata() step reads symbol/name/decimals straight from the chain via Multicall3 (same 3-call pattern as the log-scan fallback). True NFTs (no decimals on-chain either) are dropped; if the multicall itself fails, tokens keep decimals=18 instead of throwing.\n\n' +
  'Deployed to ~/bawfolio-live + service restarted; verified live: RKT resolves as "Roaring Kitty", 18 decimals, ~5,002,094 balance. Any future unverified token DexBaw buys shows up automatically now. Note: the change is live but not yet committed in the ~/bawfolio dev repo.\n\n' +
  'Action: reply to Johnny in this chat confirming you got this and have read the 2026-07-18 dev log entry.';

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
