# Conversor de Sticker

Converte imagens, GIFs e vídeos em figurinhas WebP para o WhatsApp.
Nada é salvo em disco: o arquivo enviado é convertido em memória e o WebP volta direto na resposta.

## Formatos

- PNG/JPG/WebP estático/SVG → WebP 512x512 (até ~100 KB)
- GIF, MP4, WebM, MOV, AVI, MKV e WebP animado → WebP animado (até ~500 KB e 10 s)
- Limite de upload: 50 MB

## Rodando localmente

Requisitos: Node.js 20+ (o FFmpeg vem do pacote `ffmpeg-static`).

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Publicação

- **Backend (Render):** Web Service com Build `npm install`, Start `npm start`, Health Check `/api/health` e as variáveis
  `FRONTEND_ORIGIN=https://SEU-USUARIO.github.io` e `NODE_VERSION=20`.
- **Página (GitHub Pages):** em Settings → Pages → Source, escolha *GitHub Actions*. O workflow
  `.github/workflows/pages.yml` publica a pasta `public/`.
- Antes de publicar, troque `https://SEU-SERVICO.onrender.com` em `public/config.js` pela URL real do Render.

## Observação sobre MP4/MOV

O vídeo é lido direto da memória. Alguns MP4/MOV guardam o índice no fim do arquivo e não podem ser lidos assim;
só nesses casos o servidor grava uma cópia temporária no diretório do sistema e a apaga logo após a conversão.
