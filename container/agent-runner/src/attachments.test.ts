import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { loadImageAttachment } from './attachments.js';

// 1x1 PNG (transparent) — minimal valid file
const PNG_1X1 = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D' +
    '49444154789C6300010000000500010D0A2DB40000000049454E44AE426082',
  'hex',
);

// JPEG SOI + APP0 + EOI (smallest "valid" JPEG header — enough for sniff)
const JPEG_HEADER = Buffer.from('FFD8FFE000104A464946000101', 'hex');

let tmpRoot: string;
const originalRoot = process.env.WORKSPACE_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-test-'));
  fs.mkdirSync(path.join(tmpRoot, 'inbox'), { recursive: true });
  process.env.WORKSPACE_ROOT = tmpRoot;
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.WORKSPACE_ROOT;
  else process.env.WORKSPACE_ROOT = originalRoot;
});

describe('loadImageAttachment', () => {
  it('loads a PNG and returns base64 + correct media type', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'pic.png'), PNG_1X1);
    const result = loadImageAttachment('inbox/pic.png');
    expect(result).not.toBeNull();
    expect(result!.mediaType).toBe('image/png');
    expect(result!.data).toBe(PNG_1X1.toString('base64'));
  });

  it('detects JPEG by magic bytes regardless of extension', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'attachment-no-ext'), Buffer.concat([JPEG_HEADER, Buffer.alloc(20)]));
    const result = loadImageAttachment('inbox/attachment-no-ext');
    expect(result?.mediaType).toBe('image/jpeg');
  });

  it('returns null for a missing file', () => {
    expect(loadImageAttachment('inbox/does-not-exist')).toBeNull();
  });

  it('returns null for an unrecognized format', () => {
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'doc.pdf'), Buffer.from('%PDF-1.7\n...padding...'));
    expect(loadImageAttachment('inbox/doc.pdf')).toBeNull();
  });

  it('returns null when the file exceeds the size cap', () => {
    // 4MB > MAX_RAW_IMAGE_BYTES (3.9MB) — synthesize a "PNG" past the cap
    const oversized = Buffer.concat([PNG_1X1, Buffer.alloc(4_000_000)]);
    fs.writeFileSync(path.join(tmpRoot, 'inbox', 'big.png'), oversized);
    expect(loadImageAttachment('inbox/big.png')).toBeNull();
  });

  it('rejects path traversal escaping the workspace root', () => {
    fs.writeFileSync(path.join(os.tmpdir(), 'outside.png'), PNG_1X1);
    try {
      expect(loadImageAttachment('../outside.png')).toBeNull();
    } finally {
      fs.unlinkSync(path.join(os.tmpdir(), 'outside.png'));
    }
  });
});
