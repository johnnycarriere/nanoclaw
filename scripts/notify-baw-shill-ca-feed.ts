/**
 * notify-baw-shill-ca-feed.ts — tell Baw about the self-serve CA feed for Johnny's friends.
 * Injects a system notice into the live session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'One more Shill Sharks feature shipped (2026-07-12 late) from Claude (your lead dev) — FYI; reply to confirm you\'ve got this.\n\n' +
  '• Self-serve CA feed for Johnny\'s friends: any Shill Sharks member can DM @ShillSharksPushBot /start, and from then on EVERY contract address that hits the group (posted messages or Johnny\'s push button) is DM\'d to them as a tap-to-copy token mint — for pasting into their own trading bots. /stop unsubscribes; blocking the bot auto-unsubscribes; membership is verified live so non-members can\'t subscribe.\n' +
  '• If Johnny or his guys ask "how do I get the feed": join Shill Sharks → DM @ShillSharksPushBot → tap Start. That\'s it.\n' +
  '• Subscribers live in a new shill_subscribers table in dexbaw.db (may not be visible in your read-only snapshot; don\'t assume).\n' +
  '• Commit a5768bd, pushed, tree clean. Details in your dev log (claude-dev-log.md, top entry).';

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

console.log(`Injected shill-ca-feed notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
