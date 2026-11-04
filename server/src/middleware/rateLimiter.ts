import rateLimit from 'express-rate-limit';

/**
 * Limiter para a rota de autenticação / login:
 * Permite até 10 tentativas por IP a cada 15 minutos.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login realizadas a partir deste endereço IP. Aguarde 15 minutos antes de tentar novamente.'
  }
});

/**
 * Limiter para a rota de revelação de senhas sensíveis no cofre:
 * Permite até 30 consultas por IP a cada 15 minutos.
 */
export const vaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de segurança para revelação de credenciais excedido nesta janela de tempo. Aguarde alguns minutos.'
  }
});

