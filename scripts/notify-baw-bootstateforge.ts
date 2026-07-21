/**
 * notify-baw-bootstateforge.ts — tell Baw about the Boot State Forge Shop
 * Manager built and shipped 2026-07-16. Same inbound.db injection pattern as
 * notify-agent.ts (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Boot State Forge Shop Manager — new app, built and shipped in ONE day (2026-07-16), from Claude (your lead dev). Full details in your dev log (claude-dev-log.md, seven entries today); here is the shape of it.\n\n' +
  'WHAT: complete shop-management web app for Joseph Theriot (Boot State Knives — Johnny’s knife-maker friend, IG @bootstateforge). LIVE at https://bootstateforge.duckdns.org, login joeytheriot. Runs on the Thelio: systemd user service `bootstateforge` on :8830, nginx + Let’s Encrypt, private repo johnnycarriere/bootstateforge.\n\n' +
  'STACK: Next.js 16 + Prisma 6 + SQLite at /home/jlc/bootstateforge (data/bsf.db + uploads/ = full backup). Money = integer cents; unknown historical values = NULL, never zero — load-bearing invariant, unit-tested.\n\n' +
  'FEATURES (all E2E-verified in headless Chrome): projects (knife/leather/combined sets w/ parent-child), 24/21-stage workflows, Kanban board (mobile = one bucket at a time w/ swipe), full knife/leather spec sheets incl. heat-treat data, gloves-friendly shop timer w/ wake lock, inventory w/ partial cost allocation + overdraw rejection, payments/balances, photo pipeline (sharp, reorder = cover, bulk ops, lightbox w/ swipe + inline edit, before/after pairs), quick archive for old IG builds, inquiry pipeline w/ convert-to-project, quotes engine (frozen-once-decided, versioning, win rate), batches w/ equal-split distribution, reports w/ honest-unknown insights, Trade Show Mode (mark sold = atomic payment+flip, sold-today tally), CSV import (all-or-nothing), calendar, Cmd+K palette, actionable dashboard (inline task checkoff, follow-up snooze), undo toasts on all soft deletes, sunlight light theme for outdoor markets, branded PDFs (quote/invoice/receipt/certificate of authenticity with his logo), PWA installable, owner-only clear-all-data for demo wipe.\n\n' +
  'GOTCHAS WORTH REMEMBERING (also in my memory file bootstateforge-shop-manager.md): Next 16.2 server actions that call revalidatePath NEVER deliver return values to useActionState (error paths mask it — success feedback silently dead app-wide until fixed); Tailwind v4 needs @utility for @apply-able classes; pdf-lib WinAnsi can’t encode U+2212; "use server" files may only export async functions; the bootstateforge duckdns domain lives in Johnny’s SECOND duckdns account (main 5/5 full) — auto-updated by ~/duckdns/duck-bootstateforge.sh on cron, NEVER merge it into duck.sh’s domain list (cross-account = KO, breaks plsbaw).\n\n' +
  'STATUS: feature-complete per Johnny; future work = maintenance/requests only. Joseph is already using it (real photos showing up). If Johnny or Joseph asks you about it: the README covers dev/deploy/backup, and `systemctl --user restart bootstateforge` is the restart. No reply needed — this is for your memory.';

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
