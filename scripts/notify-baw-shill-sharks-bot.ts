/**
 * notify-baw-shill-sharks-bot.ts — tell Baw the Shill Sharks push bot shipped.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Shill Sharks push bot shipped (2026-07-11) from Claude (your lead dev) — please relay a short summary to Johnny in this chat.\n\n' +
  '• Johnny\'s "Push to Shill Sharks" DexScreener button now posts through a NEW dedicated bot: @ShillSharksPushBot ("Shill Sharks Push") — @DexBawBot stays OUT of the Shill Sharks group, as Johnny wanted.\n' +
  '• Wiring: new SHILL_BOT_TOKEN env var in the dexbaw .env; /push-shill on the push server (Thelio :3099) sends via a send-only instance of that bot. dexbaw service restarted; committed + pushed (dexbaw commit 1ad1faa).\n' +
  '• Bonus fix: shill cards are now group-safe — Johnny\'s wallet-balance line and the Buy/Sell trading buttons are stripped from cards posted to the group (they would have leaked his balance / shown dead buttons). His private DexBaw push (/push) is unchanged.\n' +
  '• Verified live: test card for a Robinhood-chain token landed in Shill Sharks tonight after Johnny added the bot to the group.\n' +
  '• Full details are in your dev log (claude-dev-log.md, top entry).\n\n' +
  'Reply here with the summary for Johnny.';

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

console.log(`Injected shill-sharks-bot notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
