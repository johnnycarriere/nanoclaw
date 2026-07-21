/**
 * notify-baw360-update.ts — one-off FYI to Baw about the Baw360 family-chat update.
 * Same inbound.db injection pattern as notify-agent.ts (kind='chat', sender:system,
 * EVEN seq for host parity). Container picks it up on next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Baw360 app update shipped (FYI, no action). The fambaw family app got a round of ' +
  'chat improvements today, built + deployed by Claude on the Thelio:\n\n' +
  '• Messages list now shows profile photos (backend was returning relative photo URLs; ' +
  'fixed to absolute like /api/family).\n' +
  '• Map: people stacked at the same spot now fan out on a small circle so every avatar ' +
  'is visible/tappable.\n' +
  '• Chat now has an emoji picker and GIF search (Giphy, proxied server-side so the key ' +
  'stays in .env).\n\n' +
  'Backend is live; new Android build is r55 ' +
  '(share.bawapps.com/h/baw360-family-chat-r55-emoji-gif-mapfan.apk). Code committed on ' +
  'branch feature/family-chat-realtime in /opt/fambaw (not merged to main, not pushed). ' +
  'Johnny confirmed it working on-device. Nothing for you to do — just keeping you in the ' +
  'loop on the Baw apps. Reply to confirm you have this.';

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

console.log(`Injected Baw360 update notice id=${id} seq=${seq} → ${CHANNEL} ${PLATFORM_ID}`);
