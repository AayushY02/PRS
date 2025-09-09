// backend/src/middleware/authOptional.ts
import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../env';
import { verifyJWT } from '../auth';

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) (req as any).userId = verifyJWT(token).sub ?? null;
  } catch {}
  next();
}
