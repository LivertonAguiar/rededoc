import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEFAULT_DEV_JWT = 'rededoc-jwt-secret-condominio-aurora-2026';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ERRO FATAL: JWT_SECRET não definida no ambiente de produção.');
    }
    return DEFAULT_DEV_JWT;
  }
  return secret;
}

export type ValidRole = 'admin' | 'tecnico' | 'cliente';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: ValidRole;
    name: string;
    client_id?: string | null;
  };
}

export function generateToken(payload: { id: string; email: string; role: ValidRole; name: string; client_id?: string | null }) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Extrai o token de autenticação a partir do Header Authorization ou Query Param
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (authHeader) {
    return authHeader;
  }
  if (typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }
  return null;
}

/**
 * Middleware que extrai o token JWT caso fornecido
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = decoded;
  } catch (err) {
    // Token inválido ou expirado
  }
  next();
}

/**
 * Middleware que EXIGE autenticação válida
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): any {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

/**
 * Bloqueia usuários com papel 'cliente' de acessar rotas internas de gestão
 */
export function requireInternalRole(req: AuthRequest, res: Response, next: NextFunction): any {
  if (!req.user) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }
  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Acesso restrito. Este usuário possui acesso exclusivo ao portal do cliente.' });
  }
  next();
}

/**
 * Middleware de controle de acesso baseado em papéis (RBAC)
 */
export function requireRole(...roles: ValidRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ error: 'Acesso não autorizado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente para executar esta ação.' });
    }
    next();
  };
}
