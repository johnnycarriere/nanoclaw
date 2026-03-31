/**
 * Image processing for NanoClaw
 * Downloads, resizes, and saves images from messaging channels.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import { logger } from './logger.js';

// Max dimension (width or height) for resized images.
// Claude vision works well at 1024px and keeps token cost reasonable.
const MAX_DIMENSION = 1024;

/**
 * Download an image from a URL into a Buffer.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image download failed: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Resize an image buffer so its longest side is at most MAX_DIMENSION.
 * Returns a JPEG buffer (good balance of quality and size for vision).
 */
export async function resizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Save an image to a group's images directory.
 * Returns the host path and the corresponding container path.
 */
export function saveImageToGroup(
  groupDir: string,
  imageBuffer: Buffer,
  filename: string,
): { hostPath: string; containerPath: string } {
  const imagesDir = path.join(groupDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const hostPath = path.join(imagesDir, filename);
  fs.writeFileSync(hostPath, imageBuffer);

  // Container mounts groupDir at /workspace/group
  const containerPath = `/workspace/group/images/${filename}`;
  return { hostPath, containerPath };
}

/**
 * Full pipeline: download, resize, save to group workspace.
 * Returns the container-side path the agent can use with the Read tool.
 */
export async function processImage(
  url: string,
  groupDir: string,
  messageId: string,
): Promise<string | null> {
  try {
    const raw = await downloadImage(url);
    const resized = await resizeImage(raw);
    const filename = `photo-${messageId}-${Date.now()}.jpg`;
    const { containerPath } = saveImageToGroup(groupDir, resized, filename);

    logger.info(
      { messageId, size: resized.length, containerPath },
      'Processed image attachment',
    );
    return containerPath;
  } catch (err) {
    logger.error({ messageId, err }, 'Image processing failed');
    return null;
  }
}
