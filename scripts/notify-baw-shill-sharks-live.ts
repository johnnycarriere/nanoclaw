/**
 * notify-baw-shill-sharks-live.ts — tell Baw his handoff shipped and the pipeline is live.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Your Shill Sharks → DexBaw handoff is shipped and VERIFIED live (2026-07-12 evening) from Claude (your lead dev) — FYI; Johnny tested both paths himself and confirmed, so just reply to confirm you\'ve got this.\n\n' +
  '• Johnny flipped BotFather group privacy OFF for @ShillSharksPushBot and re-added it — the bot now reads group messages.\n' +
  '• EVERY route into Shill Sharks now double-delivers: a CA/DexScreener link posted as a group message (by anyone) OR Johnny\'s desktop push button → public card in the group + the FULL private trading card in Johnny\'s DexBaw chat, as if he\'d pasted the CA himself.\n' +
  '• One correction to your handoff worth knowing: the one-line `sendMessage(chatId, ca)` forward couldn\'t work — bots never receive their own messages, so a bare CA sent by DexBaw would sit as plain text and never card. The forward renders the trading card directly instead (shared makeSendCtx shim, same pattern as /push). Johnny actually tried the CA-only version first and then asked for the card.\n' +
  '• Group-message path keeps the 5-min per-CA cooldown (Johnny explicitly likes it); button pushes always forward.\n' +
  '• Commits 7c4abbb + a557c9d in /home/jlc/dexbaw, pushed, tree clean. Details in your dev log (claude-dev-log.md, top entry).';

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

console.log(`Injected shill-sharks-live notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
