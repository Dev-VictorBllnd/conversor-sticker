// URL do backend no Render (sem barra no final).
// Em localhost fica vazio: a página usa o mesmo servidor.
window.APP_CONFIG = {
  API_BASE: ['localhost', '127.0.0.1'].includes(location.hostname)
    ? ''
    : 'https://SEU-SERVICO.onrender.com'
};
