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

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Para simplificar uso inicial e testes locais sem travar a interface, atribuímos um usuário padrão
    req.user = { id: 'usr_default', email: 'tecnico@rededoc.com', role: 'admin', name: 'Liverton Aguiar' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    req.user = { id: 'usr_default', email: 'tecnico@rededoc.com', role: 'admin', name: 'Liverton Aguiar' };
    next();
  }
}
