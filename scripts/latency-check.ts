/**
 * latency-check.ts — read-only round-trip latency probe for a NanoClaw agent group.
 *
 * Measures the agent pipeline (message received → first response written) for recent
 * REAL chat exchanges. It never writes to any DB and never sends a message, so it is
 * safe to run against a live session: just send a normal message on the platform, then
 * run this to see how fast the agent turned it around.
 *
 *   pnpm exec tsx scripts/latency-check.ts                 # default group (telegram_main), last 10
 *   pnpm exec tsx scripts/latency-check.ts --group emacs   # by group folder
 *   pnpm exec tsx scripts/latency-check.ts --id ag-...     # by agent_group_id
 *   pnpm exec tsx scripts/latency-check.ts --limit 20      # how many exchanges to show
 *
 * Timestamps in the session DBs are second-precision UTC, so latencies resolve to ~1s.
 * That is plenty to see model/effort changes (Opus turns took tens of seconds; Sonnet
 * with low effort should land in the low single digits for short replies).
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CENTRAL_DB = join(ROOT, 'data', 'v2.db');

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const groupFolder = arg('group');
const groupId = arg('id');
const limit = Math.max(1, parseInt(arg('limit', '10')!, 10) || 10);

// --- resolve agent group --------------------------------------------------
const central = new Database(CENTRAL_DB, { readonly: true });
let group: { id: string; folder: string } | undefined;
if (groupId) {
  group = central
    .prepare('SELECT id, folder FROM agent_groups WHERE id = ?')
    .get(groupId) as typeof group;
} else if (groupFolder) {
  group = central
    .prepare('SELECT id, folder FROM agent_groups WHERE folder = ?')
    .get(groupFolder) as typeof group;
} else {
  // default: prefer a telegram_main folder, else the first group
  group =
    (central
      .prepare("SELECT id, folder FROM agent_groups WHERE folder = 'telegram_main'")
      .get() as typeof group) ??
    (central.prepare('SELECT id, folder FROM agent_groups LIMIT 1').get() as typeof group);
}
if (!group) {
  console.error('No matching agent group found.');
  process.exit(1);
}

const session = central
  .prepare(
    'SELECT id FROM sessions WHERE agent_group_id = ? ORDER BY last_active DESC LIMIT 1',
  )
  .get(group.id) as { id: string } | undefined;
central.close();

if (!session) {
  console.error(`No session found for group ${group.folder} (${group.id}).`);
  process.exit(1);
}

const sessDir = join(ROOT, 'data', 'v2-sessions', group.id, session.id);
const inPath = join(sessDir, 'inbound.db');
const outPath = join(sessDir, 'outbound.db');
if (!existsSync(inPath) || !existsSync(outPath)) {
  console.error(`Session DBs missing under ${sessDir}`);
  process.exit(1);
}

// --- pull rows (read-only) ------------------------------------------------
const inDb = new Database(inPath, { readonly: true });
const outDb = new Database(outPath, { readonly: true });

type InRow = { id: string; seq: number; timestamp: string; content: string };
// Real platform messages arrive as 'chat-sdk' (Chat SDK bridge) or 'chat' (native
// adapters). 'task'/'system' rows are agent-internal, not user turns — exclude them.
const inbound = inDb
  .prepare(
    "SELECT id, seq, timestamp, content FROM messages_in WHERE kind IN ('chat-sdk', 'chat') ORDER BY seq DESC LIMIT ?",
  )
  .all(limit * 3) as InRow[];

// first response per inbound id + how many responses
const outByReply = new Map<string, { first: string; count: number }>();
for (const r of outDb
  .prepare(
    "SELECT in_reply_to AS reply, timestamp, seq FROM messages_out WHERE kind = 'chat' AND in_reply_to IS NOT NULL ORDER BY seq ASC",
  )
  .all() as { reply: string; timestamp: string; seq: number }[]) {
  const e = outByReply.get(r.reply);
  if (e) e.count++;
  else outByReply.set(r.reply, { first: r.timestamp, count: 1 });
}

const ackById = new Map<string, { status: string; at: string }>();
for (const r of outDb
  .prepare('SELECT message_id, status, status_changed FROM processing_ack')
  .all() as { message_id: string; status: string; status_changed: string }[]) {
  ackById.set(r.message_id, { status: r.status, at: r.status_changed });
}

inDb.close();
outDb.close();

// --- compute + print ------------------------------------------------------
// Session DBs mix two stamp formats: ISO ('2026-06-13T21:09:51.000Z', from the Chat
// SDK) and space-separated UTC ('2026-06-13 21:11:12', from datetime('now')). Normalize
// both to epoch ms as UTC.
function parseTs(s: string): number {
  if (s.includes('T')) return Date.parse(s.endsWith('Z') ? s : s + 'Z');
  return Date.parse(s.replace(' ', 'T') + 'Z');
}
function ms(a: string, b: string): number {
  return parseTs(b) - parseTs(a);
}
function preview(content: string): string {
  try {
    const c = JSON.parse(content);
    const t = typeof c === 'string' ? c : (c.text ?? c.body ?? JSON.stringify(c));
    return String(t).replace(/\s+/g, ' ').slice(0, 42);
  } catch {
    return content.replace(/\s+/g, ' ').slice(0, 42);
  }
}

const rows: { when: string; secs: number | null; n: number; text: string }[] = [];
for (const m of inbound) {
  const out = outByReply.get(m.id);
  const ack = ackById.get(m.id);
  // prefer first delivered response; fall back to ack completion time
  const endStamp = out?.first ?? (ack?.status === 'completed' ? ack.at : undefined);
  rows.push({
    when: m.timestamp,
    secs: endStamp ? ms(m.timestamp, endStamp) / 1000 : null,
    n: out?.count ?? 0,
    text: preview(m.content),
  });
  if (rows.length >= limit) break;
}

console.log(`\nGroup:   ${group.folder} (${group.id})`);
console.log(`Session: ${session.id}\n`);

if (rows.length === 0) {
  console.log('No chat exchanges found yet. Send a message on the platform, then re-run.\n');
  process.exit(0);
}

console.log('  received (UTC)        latency   msgs  message');
console.log('  ' + '-'.repeat(64));
for (const r of rows.reverse()) {
  const lat = r.secs === null ? '   pending' : `${r.secs.toFixed(0).padStart(6)}s`;
  console.log(`  ${r.when}   ${lat}   ${String(r.n).padStart(3)}   ${r.text}`);
}

const done = rows.filter((r) => r.secs !== null).map((r) => r.secs!) as number[];
if (done.length) {
  const sorted = [...done].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = done.reduce((a, b) => a + b, 0) / done.length;
  console.log('  ' + '-'.repeat(64));
  console.log(
    `  n=${done.length}  min=${sorted[0].toFixed(0)}s  median=${median.toFixed(0)}s  ` +
      `avg=${avg.toFixed(1)}s  max=${sorted[sorted.length - 1].toFixed(0)}s`,
  );
}
console.log(
  '\n  Note: ~1s resolution (second-precision DB timestamps). Latency = received → first response written.\n',
);
