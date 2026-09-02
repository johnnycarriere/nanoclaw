/**
 * Persist which messages we've already emitted host-side status reactions
 * (👨‍💻 / 👍) for, so the emitter is idempotent across host restarts and
 * across the perpetually-growing `processing_ack` accumulation.
 *
 * Before this, `status-reactions.ts` kept the "already emitted" set in an
 * in-memory Map that (a) reset on every host restart and (b) was deleted
 * after firing the terminal 👍, leaving every subsequent sweep tick to
 * re-fire 👍 on every completed `processing_ack` row. Most platforms
 * silently dedupe identical reaction sets so this stayed invisible — but
 * after a context-compaction-induced reaction storm exposed the issue
 * (Telegram showed 26 simultaneous re-fires on old messages), we need a
 * real durable record.
 */
import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'host-reaction-state',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS host_reaction_state (
        message_id   TEXT PRIMARY KEY,
        last_emitted TEXT NOT NULL CHECK (last_emitted IN ('processing', 'completed')),
        updated_at   TEXT NOT NULL
      );
    `);
  },
};
