import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rededoc-jwt-secret-condominio-aurora-2026';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export function generateToken(payload: { id: string; email: string; role: string; name: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Middleware que extrai o token JWT caso fornecido
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

/**
 * Middleware de controle de acesso baseado em papéis (RBAC)
 */
export function requireRole(...roles: string[]) {
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
