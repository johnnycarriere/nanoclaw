/**
 * notify-baw-validator-mgmt.ts — one-off FYI to Baw about node.bawapps.com
 * becoming the PulseChain validator management page (2026-07-29). Same
 * inbound.db injection pattern as notify-agent.ts (kind='chat',
 * sender:system, EVEN seq for host parity). Container picks it up on next
 * poll (~1s).
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';

const AGENT_GROUP = 'ag-1776954494931-vd24yu';
const SESSION = 'sess-1776954507800-9inx0n';
const PLATFORM_ID = 'telegram:1644976441';
const CHANNEL = 'telegram';

const text =
  'PulseChain node update (2026-07-29) — FYI, no action; stay current if Johnny asks. Full detail in your dev log (claude-dev-log.md, four entries today).\n\n' +
  'node.bawapps.com is now Johnny\'s VALIDATOR MANAGEMENT PAGE, not just the health dashboard. It lives on the Thelio (pulse-stake systemd user service, port 8369, app at /home/jlc/pulsechain-staking-launchpad, private repo johnnycarriere/pulsechain-staking-launchpad); the Linode only reverse-proxies to it now. Behind basic auth (user johnnycarriere) EXCEPT POST /rpcquery/ which stays public — so anything using node.bawapps.com/rpcquery as an RPC endpoint is unaffected.\n\n' +
  'Three tabs: overview (the old plsbaw dashboard unchanged), validators (his fleet read from his own beacon node — currently his 22 launch-era validators, all exited/withdrawn in 2023, plus container/client health), stake (an audited fork of the ValidatorStore launchpad for making 32M-PLS validator deposits from Rabby; the official launchpad.pulsechain.com is dead).\n\n' +
  'Context worth knowing: the Thelio runs Johnny\'s full PulseChain validator stack under /blockchain (Docker: execution/beacon/validator). Clients were updated today (lighthouse-pulse v2.5.1; go-pulse already current). Johnny plans to stake 129M PLS as 4 new validators (32M each) — new keys required since exited validators can never rejoin. When that happens the deposits go through the stake tab and activation shows on the validators tab.\n\n' +
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
