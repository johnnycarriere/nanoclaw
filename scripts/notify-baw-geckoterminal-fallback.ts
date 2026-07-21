/**
 * notify-baw-geckoterminal-fallback.ts — tell Baw about the 2026-07-14
 * GeckoTerminal price-fallback rollout across DexBaw/BawFolio/TrackerBaw and
 * the BawFolio checker changes. Same injection pattern as notify-agent.ts
 * (host writes EVEN seq into the live session's inbound.db; container picks
 * it up next poll).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Infra handoff (2026-07-14) from Claude (your lead dev). Full details + gotchas are in the dev log (/workspace/agent/claude-dev-log.md — six new entries dated 2026-07-14); this is the summary.\n\n' +
  '1️⃣ GeckoTerminal price fallback LIVE in all three DexScreener consumers — DexBaw (0ab5567), BawFolio (b793478+bf0e772), TrackerBaw (2f9d8fe). DS lagged 15+ min again, so when DS is DOWN/erroring, prices now come from GeckoTerminal (CoinGecko, free, keyless, pulsechain/eth/base/bsc/solana; Robinhood NOT indexed — DexBaw onchainPrice.js still owns RBH). We tried DexTools first per Johnny\'s original handoff — no free tier ($9/mo) and the RapidAPI "Dextools API" is a knock-off; both abandoned same day, don\'t suggest them.\n' +
  '2️⃣ ⚠️ Key design rule that bit us: fallback keys on the PRIMARY BEING DOWN, not "primary has no answer". First BawFolio version detoured on every unlisted dust token — 2.1s rate-limit slots serialized wallet refreshes to a crawl (Johnny: "Bawfolio very slow"). bf0e772 fixed it: single path falls back only when the DS request throws; batch path also when a whole multi-token chunk comes back empty. 30 req/min per IP is SHARED by bawfolio+trackerbaw on the Linode.\n' +
  '3️⃣ BawFolio checker now defaults to 🏹 Robinhood ONLY — blank form AND bare /checker/<addr> URLs (e95f8a7+dc637af). Manual picks persist via explicit ?chains= in the URL. Old bookmarks without ?chains= now scan RH-only — if Johnny reports a bookmark "losing chains", that\'s why.\n' +
  '4️⃣ DexBaw restart no longer needs Johnny\'s sudo: the unit runs User=jlc with Restart=always, so kill the MainPID (systemctl show dexbaw -p MainPID --value) and systemd respawns it. Verified clean boot.\n' +
  '5️⃣ TrackerBaw: trackerbaw.service now loads EnvironmentFile=-/opt/trackerbaw/.env (handy for TRACKERBAW_ALLOWED_CHATS). Backups on the box: TrackerBaw.py.bak.pre-dextools-20260714 and .bak.pre-geckoterminal-20260714. Repo == deployed on all three.\n\n' +
  'Action: reply to Johnny in this chat confirming you got this handoff and have read the 2026-07-14 dev log entries.';

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
