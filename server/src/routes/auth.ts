import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { compareSystemPassword } from '../services/crypto.js';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  if (user.is_active === 0) {
    return res.status(403).json({ error: 'Acesso bloqueado. Este usuário foi desativado pelo administrador do sistema.' });
  }

  const isValid = await compareSystemPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    client_id: user.client_id || null
  });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      client_id: user.client_id || null
    }
  });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});
