/**
 * notify-baw-son-laptop.ts — tell Baw about Johnny's son's newly-repaired laptop and
 * ask him to add the SSH connection to the dashboard alongside Johnny's other machines.
 * Injects a system notice into Baw's live session inbound.db (host writer → EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu'; // "Johnny" / telegram_main (Baw)
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Baw — new machine for my dashboard (2026-06-27). Please add my son\'s laptop to the SSH connections list, alongside my other machines.\n\n' +
  '• Label: Johnny Laine\'s Laptop (son)\n' +
  '• Hardware/OS: HP EliteBook 850 G6 — Linux Mint 22.3\n' +
  '• SSH command: ssh johnnylaine@100.110.47.96\n' +
  '   – Host/IP: 100.110.47.96 (Tailscale; device name "johnnylaineelitebook")\n' +
  '   – User: johnnylaine\n' +
  '   – Auth: key-based — my nanoclaw key (jlc@nanoclaw) is already in authorized_keys, no password needed\n\n' +
  'Context: it was crashing constantly — turned out to be a dead SSD. Swapped in a known-good drive and did a fresh Linux Mint install; it\'s now stable.\n\n' +
  'Please add it to the dashboard with my others and reply here to confirm it\'s in.';

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
