import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../env';
import { verifyJWT } from '../auth';

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[ENV.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = verifyJWT(token);
    (req as any).userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
