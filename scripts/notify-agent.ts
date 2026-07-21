/**
 * notify-agent.ts — inject a one-off system notice into a live session's inbound.db so
 * the agent reads it and (when asked) replies in its chat. Mirrors the existing
 * model-change notice pattern (kind='chat', sender:system). Host is the inbound writer,
 * so seq must be EVEN. The running container picks it up on its next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  "Dirk's Chords update (2026-07-01) from Claude (your lead dev) — FYI, no action needed; full details are in the tph-chords-project.md memory.\n\n" +
  '• Big one: Dirk\'s Chords (hymns.bawapps.com, /home/jlc/tph-chords) can now read SCANNED lead sheets — the printed chords + all verses off a photo/PDF, not just clean MusicXML. Johnny\'s test hymn ("Let Us Love and Sing and Wonder") now comes back with correct chords in his key, all 5 verses as proper line-broken stanzas, and no copyright junk. Deployed + committed (branch johnny/vision-scanned-leadsheets).\n' +
  '• NEW INFRA on the Thelio you should know about: a local vision model runs via a vendored Ollama (qwen2.5vl:7b, ~6GB) at 127.0.0.1:11434 — free/on-device, nothing leaves the box. It reads the scanned chords/verses. Chords via that model, lyrics via Audiveris OMR, stitched in a hybrid.\n' +
  '• HEADS UP / open item: that Ollama server is currently a manual `nohup` process — it is NOT wired to auto-start on reboot (cron/user-service auto-start was blocked as unrequested persistence). If the Thelio reboots and scanned-hymn chords go sparse, restart it: `cd /home/jlc/tph-chords && ./run.sh` starts it, or `OLLAMA_MODELS=/home/jlc/tph-chords/vendor/ollama/models nohup vendor/ollama/bin/ollama serve &`.\n' +
  '• nginx proxy_read_timeout on hymns-bawapps was bumped 180s→600s (fresh scans take a few min on CPU, no GPU; cached after).\n\n' +
  'Reply here to confirm you\'ve got this.';

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
