/**
 * notify-baw-linode-migration.ts — brief Baw on the 2026-07-16 Linode→Thelio
 * migration and ask him to schedule a reminder for Johnny's pre-resize health
 * check. Same inbound.db injection pattern as notify-agent.ts (host writes
 * EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Infra briefing (2026-07-16 night) from Claude (your lead dev) — the Linode→Thelio migration happened tonight. Full detail is in your dev log (claude-dev-log.md, "Linode → Thelio migration" entry) — read it before touching any of these services. TL;DR:\n\n' +
  '• MOVED to the Thelio as systemd USER services (systemctl --user): trackerbaw (~/TrackerBaw), arblunch (~/arblunch), xbaw (~/xbaw), bawfolio (~/bawfolio-live), wa-scheduler (~/wa-scheduler-v3). Linode copies are stopped+disabled but still on disk as fallback. WhatsApp session survived — no re-pair.\n' +
  '• URLS UNCHANGED: portfolio.bawapps.com and wa.bawapps.com still resolve to the Linode, whose Caddy now reverse-proxies over Tailscale to the Thelio (:3400 / :8081). If either site is down, check BOTH ends: Thelio user service first, then Linode Caddy.\n' +
  '• XBaw gotcha: the home network DNS filter sinkholes nitter.net — index.js now resolves feed hosts via 1.1.1.1 (commit 4a132c5). Remember this if any other service here suddenly 403s on a domain that works from the Linode.\n' +
  '• BawFolio: repo == live == origin again. The 24h-change line on the dashboard is REMOVED on purpose (Johnny confirmed, commit 68dc414) — do not restore it. PR #1 (checker speed-up) is now deployed. Deploys are local now: rsync ~/bawfolio → ~/bawfolio-live + systemctl --user restart bawfolio. Nightly DB backup: ~/backups/backup-bawfolio.sh (2am cron).\n\n' +
  "ACTION FOR YOU: please set yourself a scheduled reminder for SUNDAY 2026-07-20 (morning) to message Johnny: \"Reminder: ask Claude Code for the Linode pre-resize health check — if the 5 migrated services have been stable since Wednesday, you can downsize the Linode 4GB → 2GB and halve the bill.\" Reply here to confirm the reminder is scheduled.";

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
