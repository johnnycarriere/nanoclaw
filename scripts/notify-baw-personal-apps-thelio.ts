/**
 * notify-baw-personal-apps-thelio.ts — one-off FYI to Baw about the 2026-08-03
 * TaskBaw + Baw Sky telemetry migration off the Linode, plus the pulse-stake
 * boot-race fix. Same inbound.db injection pattern as notify-agent.ts
 * (kind='chat', sender:system, EVEN seq for host parity). Container picks it
 * up on next poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Infra update (2026-08-03) — two personal apps moved off the Refinery Linode onto the Thelio, plus a 3-day outage found and fixed. Full detail in your dev log (claude-dev-log.md, two entries today). FYI, no action needed — but one deploy-workflow change affects YOU directly.\n\n' +
  '1) TaskBaw sync server: now ~/taskbaw-server on the Thelio, systemd USER service `taskbaw`, binds 100.100.132.76:3015. https://taskbaw.bawapps.com is unchanged (Linode Caddy reverse-proxies over tailnet). Live DB + recovery.pepper + all 310 per-device backups migrated zero-loss (Linode service stopped first). ⚠️ DEPLOY CHANGE FOR YOU: server deploys are now `cd ~/taskbaw-server && git pull && npm run build && systemctl --user restart taskbaw` ON THE THELIO — do NOT deploy to the Linode /opt/taskbaw anymore (it is stopped/disabled, kept as fallback only). Two commits of note: I pulled your 617788d (per-device isolation — the Linode was already running it) before building, and pushed 1c758c0 (HOST env var so the server can bind the tailnet IP).\n\n' +
  '2) Baw Sky telemetry: now ~/bawsky-telemetry on the Thelio, user service, binds 100.100.132.76:8097; https://bawsky.bawapps.com unchanged (TLS still terminates on the Linode, Porkbun DNS block untouched). feedback/outcomes jsonl migrated with a final delta sync. Token now readable locally: grep BAWSKY_TELEMETRY_TOKEN ~/bawsky-telemetry/.env (no more ssh to the Linode).\n\n' +
  '3) node.bawapps.com (pulse-stake) had been DOWN since the 7/31 Thelio reboot — boot race: it binds the tailnet IP before tailscaled assigns it, and the unit retried 5x in <1s then gave up permanently. Fixed with RestartSec=5 + StartLimitIntervalSec=0; back up and verified. Rule worth remembering: any Thelio service binding 100.100.132.76 needs those two lines in its unit.\n\n' +
  'Both new services are in the nightly backup + RECOVERY.md. Old Linode copies stopped + disabled but left on disk; Caddyfile backup at /etc/caddy/Caddyfile.bak-taskbaw-migration.\n\n' +
  'Reply here to confirm you have this.';

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
