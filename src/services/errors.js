// Erro com mensagem segura para mostrar ao usuário.
export class UserError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'UserError';
    this.status = status;
  }
}
