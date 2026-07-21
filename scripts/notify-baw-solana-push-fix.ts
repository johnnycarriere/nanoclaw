/**
 * notify-baw-solana-push-fix.ts — tell Baw the Solana push fix + auto-card feature shipped.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'DexBaw push updates (2026-07-12) from Claude (your lead dev) — FYI for your knowledge; Johnny already knows and confirmed it works, so just reply here to confirm you\'ve got this (no need to re-announce).\n\n' +
  '• BUG FIXED — Solana pushes were completely broken: DexScreener serves its Solana pair URLs all-lowercase, and base58 addresses are case-sensitive, so every Solana coin pushed to DexBaw or Shill Sharks failed with "No contract address found". Fix: URL-sourced addresses now resolve through the DexScreener pairs API (case-insensitive, returns the proper-case token mint). Also applies to pasting/sharing links directly into the DexBaw chat. Verified live — Johnny\'s failed RIBBIT push now cards instantly. Commit 83998e5.\n' +
  '• NEW (dormant until Johnny activates): auto-card in Shill Sharks — any DexScreener link posted in the group gets a card reply from @ShillSharksPushBot (5-min per-CA cooldown). Lets phones "push" via Android share → Telegram → group. Needs Johnny to run BotFather /setprivacy → Disable for the bot, then remove+re-add it to the group; he said he\'ll revisit whether he wants this. Commit f503917.\n' +
  '• Reminder from last night (commit 6219773): shill cards are photo cards with hype stats + Chart/Website/X/TG buttons + 🔄 Refresh, and the V3 reciprocal-price bug is fixed (prices on V3-pair cards before ~10:15 PM 7/11 were wrong).\n' +
  '• Everything committed + pushed in /home/jlc/dexbaw (latest 83998e5, tree clean). Full details in your dev log (claude-dev-log.md, top entry).';

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

console.log(`Injected solana-push-fix notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
