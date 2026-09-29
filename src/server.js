import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { detectFile } from './services/detectFile.js';
import { convertStaticImage } from './services/convertImage.js';
import { convertAnimated } from './services/convertAnimated.js';
import { UserError } from './services/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  'https://dev-victorblnd.github.io';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Plano free do Render tem pouca RAM:
// evita cache e paralelismo do Sharp.
sharp.cache(false);
sharp.concurrency(1);

// Origens permitidas
const allowedOrigins = [
  FRONTEND_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// CORS
app.use(cors({
  origin: allowedOrigins,
  exposedHeaders: [
    'X-Sticker-Animated',
    'X-Sticker-Size',
    'X-Detected-Mime'
  ]
}));

// Serve a página no uso local.
// Em produção, o frontend fica no GitHub Pages.
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'conversor-sticker'
  });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

app.post(
  '/api/stickers',
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Nenhum arquivo enviado.'
      });
    }

    const { buffer, originalname } = req.file;

    try {
      // Detecta o tipo real do arquivo
      const detected = await detectFile(buffer, originalname);

      if (detected.kind === 'unsupported') {
        return res.status(415).json({
          error:
            'Este arquivo não possui um formato visual compatível nesta versão.'
        });
      }

      let webp;
      let animated = false;

      // Imagem estática
      if (detected.kind === 'static') {
        webp = await convertStaticImage(buffer);
      }

      // WebP: pode ser estático ou animado
      else if (detected.kind === 'webp') {
        const metadata = await sharp(buffer, {
          animated: true
        }).metadata();

        if ((metadata.pages ?? 1) > 1) {
          ({ buffer: webp } = await convertAnimated(buffer));
          animated = true;
        } else {
          webp = await convertStaticImage(buffer);
        }
      }

      // GIF, MP4, WebM, MOV, AVI, MKV etc.
      else {
        ({ buffer: webp } = await convertAnimated(buffer));
        animated = true;
      }

      // O WebP volta diretamente na resposta.
      // Nada é salvo permanentemente no disco.
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store',
        'X-Sticker-Animated': String(animated),
        'X-Sticker-Size': String(webp.length),
        'X-Detected-Mime': detected.mime ?? ''
      });

      return res.send(webp);

    } catch (error) {
      if (error instanceof UserError) {
        return res.status(error.status).json({
          error: error.message
        });
      }

      console.error(error);

      return res.status(500).json({
        error: 'Falha ao converter o arquivo.'
      });
    }
  }
);

// Erros do Multer
// Ex.: arquivo maior que 50 MB.
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';

    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge
        ? 'Arquivo muito grande. O limite é 50 MB.'
        : 'Falha ao receber o arquivo.'
    });
  }

  console.error(error);

  return res.status(500).json({
    error: 'Erro interno.'
  });
});

// Importante para o Render:
// o servidor precisa escutar em 0.0.0.0.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});