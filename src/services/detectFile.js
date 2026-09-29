import { fileTypeFromBuffer } from 'file-type';
import path from 'node:path';

const STATIC_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/svg+xml'
]);

const ANIMATED_TYPES = new Set([
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska'
]);

export async function detectFile(buffer, originalName = '') {
  const detected = await fileTypeFromBuffer(buffer);
  const extension = path.extname(originalName).toLowerCase();
  const mime = detected?.mime ?? null;

  // SVG não é detectado como imagem raster pelo file-type, então tratamos
  // explicitamente pela extensão nesta primeira versão.
  if (!mime && extension === '.svg') {
    return { mime: 'image/svg+xml', kind: 'static', extension };
  }

  if (!mime) {
    return { mime: null, kind: 'unsupported', extension };
  }

  if (mime === 'image/webp') {
    // WebP pode ser estático ou animado. Sharp/FFmpeg irão decidir depois.
    return { mime, kind: 'webp', extension };
  }

  if (ANIMATED_TYPES.has(mime) && (mime.startsWith('video/') || mime === 'image/gif')) {
    return { mime, kind: 'animated', extension };
  }

  if (STATIC_TYPES.has(mime)) {
    return { mime, kind: 'static', extension };
  }

  return { mime, kind: 'unsupported', extension };
}
