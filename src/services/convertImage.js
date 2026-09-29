import sharp from 'sharp';

import { UserError } from './errors.js';

const MAX_STATIC_BYTES = 100 * 1024;

function fitToSticker(input) {
  return sharp(input, { animated: false })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
}

export async function convertStaticImage(input) {
  let quality = 90;
  let output;

  // Tenta reduzir a qualidade até caber no limite de figurinha estática.
  while (quality >= 20) {
    output = await fitToSticker(input)
      .webp({ quality, effort: 6 })
      .toBuffer();

    if (output.length <= MAX_STATIC_BYTES) {
      return output;
    }

    quality -= 10;
  }

  // Se mesmo assim não couber, reduz a resolução mantendo o formato 512x512
  // da figurinha por meio de padding transparente.
  for (const innerSize of [480, 448, 416, 384]) {
    output = await sharp(input, { animated: false })
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.floor((512 - innerSize) / 2),
        bottom: Math.ceil((512 - innerSize) / 2),
        left: Math.floor((512 - innerSize) / 2),
        right: Math.ceil((512 - innerSize) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 20, effort: 6 })
      .toBuffer();

    if (output.length <= MAX_STATIC_BYTES) {
      return output;
    }
  }

  throw new UserError('Não foi possível gerar uma figurinha estática dentro de 100 KB.');
}
