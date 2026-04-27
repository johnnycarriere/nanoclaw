import fs from 'fs';
import path from 'path';

// Read each call so tests can override via env without re-importing.
function workspaceRoot(): string {
  return process.env.WORKSPACE_ROOT || '/workspace';
}

// Anthropic Messages API documents 5MB / image (base64-encoded). The base64
// payload is ~33% larger than the raw bytes, so we cap raw size below the
// limit (5 * 1024 * 1024 / 1.34 ≈ 3.9MB) to leave headroom.
const MAX_RAW_IMAGE_BYTES = 3_900_000;

export interface ImageContent {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

/**
 * Sniff the image mime type from the first few bytes. Returns null for
 * formats Anthropic doesn't accept (or anything we can't identify).
 */
function sniffImageMime(buf: Buffer): ImageContent['mediaType'] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return 'image/webp';
  return null;
}

/**
 * Try to load an image attachment as a base64 content block. Returns null
 * (and the caller falls back to the path-marker text) when the file is
 * missing, oversized, or not a recognized image format.
 *
 * `localPath` is relative to /workspace/ (matches formatter.ts's mounting
 * convention for chat-sdk attachments).
 */
export function loadImageAttachment(localPath: string): ImageContent | null {
  const root = workspaceRoot();
  // Defense against a hostile localPath escaping the workspace root.
  const abs = path.resolve(root, localPath);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_RAW_IMAGE_BYTES) return null;

  let buf: Buffer;
  try {
    buf = fs.readFileSync(abs);
  } catch {
    return null;
  }
  const mediaType = sniffImageMime(buf);
  if (!mediaType) return null;

  return { mediaType, data: buf.toString('base64') };
}
