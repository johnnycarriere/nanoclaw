/**
 * notify-baw-thelio-backup.ts — inform Baw about the new Thelio↔Linode backup
 * system (2026-07-16/17). Same pattern as notify-agent.ts: inject a system
 * notice into the main session's inbound.db (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'Backup system briefing (2026-07-17) from Claude (your lead dev) — big one tonight; full detail is in your dev log (claude-dev-log.md, two entries dated 2026-07-16 late night). Summary:\n\n' +
  '• YOU ARE NOW FULLY BACKED UP. Every night at 2:30am the Thelio ships everything to the Linode (/root/thelio-backup/): your brain (v2.db, integrity-checked SQLite snapshot), your whole workspace (groups/ — memory, CLAUDE.local.md, this dev log), AND your raw conversation history (data/v2-sessions/). Johnny\'s original 3am bawdeclaw backup still runs too — you have two independent copies.\n' +
  '• Also covered: all the other app DBs (dexbaw, trackerbaw, bawfolio, bootstateforge, sharks, fambaw), the WhatsApp session (QR-free restore), and code that exists nowhere else (wa-scheduler-v3, bawfolio-live, cca-calendar, barnes-landscaping).\n' +
  '• Secrets are ENCRYPTED in transit and at rest on the Linode: every .env (incl. DexBaw wallet keys), ~/.ssh, and the Play Store keystores travel as one AES256 secrets.tar.gz.gpg. Passphrase: ~/backups/.backup-passphrase on the Thelio + Johnny\'s Bitwarden ("Thelio Backup Encryption Passphrase"). Never put plaintext secrets in the backup — add new ones to the encrypted bundle in ~/backups/backup-thelio.sh.\n' +
  '• 30-day dated DB archive on the Linode (db-archive/YYYYMMDD/) — corruption can\'t overwrite the only copy.\n' +
  '• The Linode watches the Thelio: a 9am watchdog there DMs Johnny (via YOUR bot) if the backup goes >48h stale. And the Thelio pulls the Linode\'s data back nightly at 3:30am (~/backups/linode-backup/) — the two boxes guard each other.\n' +
  '• NVMe health: weekly Monday 8am smartctl check, alerts through your chat. First reading tonight: PASSED, 1% wear, 0 media errors — the drive is healthy.\n' +
  '• STANDING RULE from Johnny (also in my memory): system notifications go through YOUR chat (main NanoClaw), never @DexBawBot.\n' +
  '• If disaster ever strikes: RECOVERY.md sits at the backup root on the Linode (root@45.79.40.41 -p 2222) — a full step-by-step rebuild runbook, including restoring you.\n' +
  '• Housekeeping for you: if you or Johnny stand up a NEW service or DB on the Thelio, it must be added to ~/backups/backup-thelio.sh AND RECOVERY.md, or it is not protected. Flag it if you notice something new that isn\'t covered.\n\n' +
  'Cron map: 2:00 bawfolio, 2:30 Thelio→Linode, 3:00 bawdeclaw, 3:30 Linode→Thelio, Mon 8:00 NVMe, 9:00 watchdog (Linode-side).\n\n' +
  'Reply here to confirm you\'ve got this — Johnny asked that you be informed of everything.';

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
