/**
 * v1-parity tests for formatter behavior.
 *
 * Port of src/v1/formatting.test.ts (at commit 27c5220, parent of the v1
 * deletion commit 86becf8). Covers: context timezone header, reply_to +
 * quoted_message rendering, XML escaping, and stripInternalTags.
 *
 * Timestamp-format assertions use `formatLocalTime()` output format, which
 * is host locale-dependent for decorators (month abbr, "," separator) but
 * stable for the numeric parts we assert on (hour, minute, year).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './db/connection.js';
import { getPendingMessages } from './db/messages-in.js';
import { formatMessages, formatMessagesForPrompt, stripInternalTags } from './formatter.js';
import { TIMEZONE } from './timezone.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function insertMessage(
  id: string,
  kind: string,
  content: object,
  opts?: { timestamp?: string },
) {
  const timestamp = opts?.timestamp ?? new Date().toISOString();
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, content)
       VALUES (?, ?, ?, 'pending', ?)`,
    )
    .run(id, kind, timestamp, JSON.stringify(content));
}

describe('context timezone header', () => {
  it('prepends <context timezone="..."/> to formatted output', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hello' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('includes the header even when the message list is empty', () => {
    const result = formatMessages([]);
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('header comes before the <messages> block', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'one' });
    insertMessage('m2', 'chat', { sender: 'Bob', text: 'two' });
    const result = formatMessages(getPendingMessages());
    const ctxIdx = result.indexOf('<context');
    const msgsIdx = result.indexOf('<messages>');
    expect(ctxIdx).toBeGreaterThanOrEqual(0);
    expect(msgsIdx).toBeGreaterThan(ctxIdx);
  });
});

describe('timestamp formatting', () => {
  it('renders time via formatLocalTime (user TZ)', () => {
    // 2026-06-15T12:00:00Z — timezone-agnostic assertions (year is stable)
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T12:00:00.000Z' });
    const result = formatMessages(getPendingMessages());
    // formatLocalTime's format in en-US contains the year and a month abbrev
    expect(result).toContain('2026');
    expect(result).toMatch(/Jun/);
  });

  it('uses 12-hour AM/PM format', () => {
    // 15:30 UTC — some hour will show with AM or PM depending on TZ
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T15:30:00.000Z' });
    const result = formatMessages(getPendingMessages());
    expect(result).toMatch(/(AM|PM)/);
  });
});

describe('reply_to + quoted_message rendering', () => {
  it('renders reply_to attribute and quoted_message when all fields present', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'Yes, on my way!',
      replyTo: { id: '42', sender: 'Bob', text: 'Are you coming tonight?' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).toContain('<quoted_message from="Bob">Are you coming tonight?</quoted_message>');
    expect(result).toContain('Yes, on my way!</message>');
  });

  it('omits reply_to and quoted_message when no reply context', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'plain' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('reply_to');
    expect(result).not.toContain('quoted_message');
  });

  it('renders reply_to but omits quoted_message when original content is missing', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'ack',
      replyTo: { id: '42', sender: 'Bob' }, // no text
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).not.toContain('quoted_message');
  });

  it('XML-escapes reply context', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'reply',
      replyTo: { id: '1', sender: 'A & B', text: '<script>alert("xss")</script>' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('from="A &amp; B"');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&quot;xss&quot;');
  });
});

describe('XML escaping', () => {
  it('escapes <, >, &, " in sender and body', () => {
    insertMessage('m1', 'chat', {
      sender: 'A & B <Co>',
      text: '<script>alert("xss")</script>',
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="A &amp; B &lt;Co&gt;"');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('stripInternalTags', () => {
  it('strips single-line internal tags and trims', () => {
    expect(stripInternalTags('hello <internal>secret</internal> world')).toBe('hello  world');
  });

  it('strips multi-line internal tags', () => {
    expect(stripInternalTags('hello <internal>\nsecret\nstuff\n</internal> world')).toBe(
      'hello  world',
    );
  });

  it('strips multiple internal tag blocks', () => {
    expect(stripInternalTags('<internal>a</internal>hello<internal>b</internal>')).toBe('hello');
  });

  it('returns empty string when input is only internal tags', () => {
    expect(stripInternalTags('<internal>only this</internal>')).toBe('');
  });

  it('returns input unchanged when there are no internal tags', () => {
    expect(stripInternalTags('hello world')).toBe('hello world');
  });

  it('preserves content that surrounds internal tags', () => {
    expect(stripInternalTags('<internal>thinking</internal>The answer is 42')).toBe(
      'The answer is 42',
    );
  });
});

describe('image attachment inlining (formatMessagesForPrompt)', () => {
  // 1x1 PNG — minimal valid file for the magic-byte sniffer
  const PNG_1X1 = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D' +
      '49444154789C6300010000000500010D0A2DB40000000049454E44AE426082',
    'hex',
  );

  let tmpRoot: string;
  const originalRoot = process.env.WORKSPACE_ROOT;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-images-'));
    fs.mkdirSync(path.join(tmpRoot, 'inbox'), { recursive: true });
    process.env.WORKSPACE_ROOT = tmpRoot;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.WORKSPACE_ROOT;
    else process.env.WORKSPACE_ROOT = originalRoot;
  });

  it('extracts an image attachment as a base64 content block and emits a brief placeholder', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'pic.png'), PNG_1X1);
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run(
        'm1',
        'chat-sdk',
        new Date().toISOString(),
        JSON.stringify({
          sender: 'Johnny',
          text: 'check this out',
          attachments: [{ type: 'image', name: 'pic.png', localPath: 'inbox/pic.png' }],
        }),
      );

    const result = formatMessagesForPrompt(getPendingMessages());

    expect(result.images).toHaveLength(1);
    expect(result.images[0].mediaType).toBe('image/png');
    expect(result.images[0].data).toBe(PNG_1X1.toString('base64'));
    // Placeholder kept so the model can correlate the rendered image with
    // its message context; the verbose path marker is gone.
    expect(result.text).toContain('[image: pic.png]');
    expect(result.text).not.toContain('saved to /workspace/');
  });

  it('falls back to the path marker when the image file is missing', () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run(
        'm1',
        'chat-sdk',
        new Date().toISOString(),
        JSON.stringify({
          sender: 'Johnny',
          text: 'lost image',
          attachments: [{ type: 'image', name: 'gone.png', localPath: 'inbox/gone.png' }],
        }),
      );

    const result = formatMessagesForPrompt(getPendingMessages());

    expect(result.images).toHaveLength(0);
    expect(result.text).toContain('saved to /workspace/inbox/gone.png');
  });

  it('leaves non-image attachments as path markers regardless of sink', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'doc.pdf'), '%PDF-1.7\n');
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run(
        'm1',
        'chat-sdk',
        new Date().toISOString(),
        JSON.stringify({
          sender: 'Johnny',
          text: 'see attached',
          attachments: [{ type: 'document', name: 'doc.pdf', localPath: 'inbox/doc.pdf' }],
        }),
      );

    const result = formatMessagesForPrompt(getPendingMessages());

    expect(result.images).toHaveLength(0);
    expect(result.text).toContain('saved to /workspace/inbox/doc.pdf');
  });

  it('legacy formatMessages (no sink) keeps the verbose path marker for images', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'pic.png'), PNG_1X1);
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run(
        'm1',
        'chat-sdk',
        new Date().toISOString(),
        JSON.stringify({
          sender: 'Johnny',
          text: 'pic',
          attachments: [{ type: 'image', name: 'pic.png', localPath: 'inbox/pic.png' }],
        }),
      );

    const text = formatMessages(getPendingMessages());

    expect(text).toContain('saved to /workspace/inbox/pic.png');
  });
});
