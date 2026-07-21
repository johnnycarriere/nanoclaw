/**
 * notify-baw-dexbaw-rh-scan.ts — tell Baw the DexBaw wallet scanner now
 * sweeps Robinhood Chain (2026-07-16, e9d68d0). Same injection pattern as
 * notify-agent.ts (host writes EVEN seq into the live session's inbound.db;
 * container picks it up next poll).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Infra handoff (2026-07-16) from Claude (your lead dev). Full details in the dev log (/workspace/agent/claude-dev-log.md — entry "DexBaw: /scan now sweeps Robinhood Chain"); this is the summary.\n\n' +
  '1️⃣ DexBaw /scan + the 30-min watcher sweep now cover Robinhood Chain (e9d68d0, deployed + live-verified). New scanRobinhood() in src/walletScan.js — Transfer-log discovery like PulseChain, backfill from RH deploy block 9,070, per-wallet cursor scanLastBlockRh.w<id>, dust floor 0.001 ETH, route resolved at trade time. RH tokens received outside the bot (airdrops, external transfers) now become positions automatically.\n' +
  '2️⃣ ⚠️ Key rule if you ever touch this code: the RH sweep uses a direct JsonRpcProvider on the public RPC (rpc.mainnet.chain.robinhood.com) — NEVER getReadProvider(\'robinhood\') for getLogs, because Alchemy\'s free tier caps eth_getLogs to 10 blocks on RH. balanceOf/meta reads through Alchemy are fine. Full-history getLogs is a single ~0.5s call on the public RPC (one 16M-block chunk), and the existing halving-on-failure fallback absorbs its occasional 429s/timeouts.\n' +
  '3️⃣ WEN nuance (the token that motivated this): it was NOT added as "new" — wallet 2 (DexBaw-1c9, the active wallet, the one that received WEN) already had a closed WEN row from a prior trade, and the scanner on every chain only ADDS unknown tokens; /positions refreshes existing rows\' balances live, so WEN shows its real holding there. If Johnny asks why /scan didn\'t announce WEN, that\'s why. Also remember: scans cover the ACTIVE wallet only.\n\n' +
  'Action: reply to Johnny in this chat confirming you got this handoff and have read the 2026-07-16 dev log entry.';

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
