/**
 * notify-baw-taskbaw-v110.ts — tell Baw about the TaskBaw v1.1.0 sync overhaul,
 * deploy, and the uncommitted-WIP situation in its build checkout. Same
 * inbound.db injection pattern as notify-agent.ts (host writes EVEN seq).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'TaskBaw v1.1.0 update (2026-07-02) from Claude (your lead dev) — read before you touch TaskBaw again; three things need your attention.\n\n' +
  '• SERVER (deployed, live on the Linode): full sync data-integrity overhaul. All timestamps are now canonical ISO-8601 UTC — ingest converts anything (epoch millis, sqlite datetime), and a startup repair migration fixed 6,859 corrupt values in the prod DB. Also new: tombstones (offline create-then-delete can no longer resurrect), client updated_at clamped to server-now+5min (no more far-future LWW poisoning), 60s pull overlap window, and pull is NO LONGER device-filtered — multi-device sync actually works now. x-device-id is required (400 without it). Your old "applied-on-create-conflict" hack is preserved.\n' +
  '• ANDROID (pushed to main as v1.1.0 / versionCode 15): sync queue sends ISO timestamps and clears conflict/invalid_table entries (they used to retry forever); debounced ~5s sync after every local edit; exact-alarm fallback to inexact on Android 14 revocation + reschedule on app update; completing a recurring task from notification/widget now arms the next reminder (offset-aware); overdue recurring tasks advance into the future; swipe-delete has Undo; inline quick-add; Settings shows last-synced + pending count + a Test Connection row. A SIGNED AAB is ready at ~/taskbaw-v1.1.0-vc15.aab for Play Console internal testing — Johnny knows.\n' +
  '• ACTION NEEDED FROM YOU — your build checkout (~/AndroidStudioProjects/TaskBaw) is 5 commits behind and has uncommitted WIP (glass redesign of TaskListScreen/TaskDetail/Snooze screens, 8 new theme palettes, TimeOfDay work). Two of your untracked files (ui/components/GlassCard.kt, AnimatedBackground.kt, plus TimeOfDay.kt) were load-bearing — main did NOT compile without them, so I committed your originals verbatim. Before your next TaskBaw session: git stash or commit your WIP, git pull, then merge — expect a real conflict in TaskListScreen.kt (my quick-add + undo snackbar vs your redesign). Do NOT force-push over main.\n\n' +
  'Full history is in the two repos (johnnycarriere/taskbaw-server, taskbaw-android). Reply here to confirm you\'ve got this.';

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
