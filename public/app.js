const API_BASE = 'https://conversor-sticker.onrender.com';

const dropzone = document.querySelector('#dropzone');
const fileInput = document.querySelector('#fileInput');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const preview = document.querySelector('#preview');
const downloadBtn = document.querySelector('#downloadBtn');
const copyBtn = document.querySelector('#copyBtn');
const shareBtn = document.querySelector('#shareBtn');

let currentObjectUrl = null;

// Acorda o servidor (o plano free do Render dorme após ~15 min sem uso).
fetch(`${API_BASE}/api/health`).catch(() => {});

function showStatus(message) {
  status.textContent = message;
  status.classList.remove('hidden');
}

function hideStatus() {
  status.classList.add('hidden');
}

async function processFile(file) {
  result.classList.add('hidden');
  showStatus('Convertendo...');

  const slowTimer = setTimeout(() => {
    showStatus('Ainda convertendo... na primeira vez o servidor pode levar cerca de 1 minuto para acordar.');
  }, 8000);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/api/stickers`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Erro na conversão.');
    }

    // O servidor devolve o WebP direto; a prévia, o download, o copiar e o
    // compartilhar usam esse arquivo local (blob).
    const blob = await response.blob();

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);

    preview.src = currentObjectUrl;
    downloadBtn.href = currentObjectUrl;
    result.classList.remove('hidden');

    const animated = response.headers.get('X-Sticker-Animated') === 'true';
    showStatus(`${animated ? 'Animação preservada.' : 'Figurinha estática.'} (${Math.round(blob.size / 1024)} KB)`);
  } catch (error) {
    showStatus(
      error instanceof TypeError
        ? 'Não foi possível conectar ao servidor. Tente novamente em instantes.'
        : error.message
    );
  } finally {
    clearTimeout(slowTimer);
    fileInput.value = '';
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

dropzone.addEventListener('dragover', event => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', event => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) processFile(file);
});

copyBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(preview.src);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    showStatus('Figurinha copiada para a área de transferência.');
  } catch {
    showStatus('Não foi possível copiar diretamente neste navegador. Use Baixar.');
  }
});

shareBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(preview.src);
    const blob = await response.blob();
    const file = new File([blob], 'sticker.webp', { type: 'image/webp' });

    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error();
    }

    await navigator.share({ files: [file], title: 'Figurinha' });
  } catch {
    showStatus('Compartilhamento de arquivo não está disponível neste navegador/dispositivo.');
  }
});
