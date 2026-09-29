import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

import { UserError } from './errors.js';

const MAX_ANIMATED_BYTES = 500 * 1024;
const MAX_DURATION_SECONDS = 10;

// Quando o WebP sai por pipe (não "seekable"), o FFmpeg deixa o tamanho RIFF
// zerado no cabeçalho e anexa bytes extras no final. Aqui o arquivo é
// normalizado em memória: corta o que sobra depois do último chunk e grava o
// tamanho correto no cabeçalho.
function fixWebpBuffer(buf) {
  if (buf.length < 20 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('FFmpeg não gerou um WebP válido.');
  }

  let end = 12;
  while (end + 8 <= buf.length) {
    const chunkSize = buf.readUInt32LE(end + 4);
    const next = end + 8 + chunkSize + (chunkSize & 1);
    if (next > buf.length) break;
    end = next;
  }

  const fixed = Buffer.from(buf.subarray(0, end));
  fixed.writeUInt32LE(end - 8, 4);
  return fixed;
}

// input: { buffer } → lido pelo stdin | { filePath } → lido de um arquivo
function runFfmpeg(input, fps, quality) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', input.filePath ?? 'pipe:0',
      '-t', String(MAX_DURATION_SECONDS),
      '-an',
      '-vf', `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0`,
      '-c:v', 'libwebp',
      '-q:v', String(quality),
      '-compression_level', '6',
      '-loop', '0',
      '-preset', 'default',
      '-f', 'webp',
      'pipe:1'
    ];

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: [input.filePath ? 'ignore' : 'pipe', 'pipe', 'pipe']
    });

    const chunks = [];
    let stderr = '';

    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk.toString()).slice(-1500);
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`FFmpeg falhou (código ${code}). ${stderr}`));

      try {
        resolve(fixWebpBuffer(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    });

    if (!input.filePath) {
      // EPIPE é esperado quando o FFmpeg para de ler (ex.: vídeo com mais de 10 s).
      child.stdin.on('error', () => {});
      child.stdin.end(input.buffer);
    }
  });
}

export async function convertAnimated(buffer) {
  // Primeiro preservamos mais qualidade; depois reduzimos qualidade e FPS
  // para tentar respeitar o limite de 500 KB.
  const attempts = [
    [15, 50],
    [12, 45],
    [10, 40],
    [8, 35],
    [6, 30]
  ];

  let source = { buffer };
  let tempDir = null;

  try {
    for (const [fps, quality] of attempts) {
      let output;

      try {
        output = await runFfmpeg(source, fps, quality);
      } catch (error) {
        if (source.filePath) {
          console.error(error);
          throw new UserError('Não foi possível processar este vídeo/animação.');
        }

        // Alguns MP4/MOV guardam o índice (moov) no fim do arquivo e não podem
        // ser lidos de um pipe. Só nesse caso usamos um arquivo temporário do
        // sistema, apagado no finally abaixo.
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `sticker-${randomUUID()}-`));
        const filePath = path.join(tempDir, 'input');
        await fs.writeFile(filePath, buffer);
        source = { filePath };

        try {
          output = await runFfmpeg(source, fps, quality);
        } catch (retryError) {
          console.error(retryError);
          throw new UserError('Não foi possível processar este vídeo/animação.');
        }
      }

      if (output.length <= MAX_ANIMATED_BYTES) {
        return { buffer: output, size: output.length, fps, quality };
      }
    }

    throw new UserError('Não foi possível gerar uma figurinha animada dentro de 500 KB. Tente um vídeo mais curto ou mais simples.');
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
