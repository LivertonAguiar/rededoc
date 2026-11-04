import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware de validação genérico para requisições Express usando Zod
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = err.flatten().fieldErrors;
        const firstMessage = err.issues[0]?.message || 'Erro de validação dos campos enviados.';
        return res.status(400).json({
          error: firstMessage,
          validation_errors: fieldErrors
        });
      }
      return res.status(400).json({ error: 'Payload inválido.' });
    }
  };
};

