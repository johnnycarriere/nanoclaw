/**
 * notify-baw-learnview-photos.ts — inject a one-off system notice into Baw's live DM
 * session inbound.db (same pattern as notify-agent.ts: kind='chat', sender:system,
 * EVEN seq = host parity). The running container picks it up on its next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  "Refinery Dashboards update (2026-07-02) from Claude (your lead dev) — FYI, no action needed; HANDOFF.md on the box has the full session log.\n\n" +
  '• Learn View (the flash-card photo grid on /dashboard/census that shipped this morning, commit a50450c) got its photos fixed: they were blurry on the bigger cards. Two commits, both live + pushed:\n' +
  '  – a59f312: base thumbnails 240px→420px q88, and the XL card size was removed (S/M/L now; stale localStorage "xl" choices auto-migrate to "l").\n' +
  '  – e84a03f: the real root cause — portrait photos through fit:inside only had ~315px of usable width after the square card crop. /api/photo now takes ?s=lg → a 900px sharpened thumb that only the Learn View cards request; the tiny 44px roster circles keep the light 420px default. photoCache is keyed per variant, and the photo upload/remove routes prime/bust BOTH variants (worth remembering if you ever touch that code).\n' +
  '• Johnny confirmed on-screen: "much more sharp." He also asked about round photos on the cards — decision was to KEEP rounded-square (a circle crop loses ~21% of the face area; this view exists for learning faces). Circles stay the convention for small avatars only.\n' +
  '• HANDOFF.md has a new "Session log — 2026-07-02" entry with all of this (commit c5a769e), superseding the old "photos are full-res, sharp would help" perf notes.\n' +
  '• Heads-up for your own future dashboard work: creating throwaway prod login users for verification is now classifier-blocked in Claude Code sessions without Johnny\'s explicit go-ahead in the prompt — verification this round was on-box pipeline unit runs + public static-asset fetches + Johnny\'s eyeballs.\n\n' +
  "Reply here to confirm you've got this.";

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
