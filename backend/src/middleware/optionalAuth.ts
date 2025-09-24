import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../env';
import { verifyJWT } from '../auth';

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) {
      const payload = verifyJWT(token);
      (req as any).userId = payload.sub ?? null;
    } else {
      (req as any).userId = null;
    }
  } catch {
    (req as any).userId = null;
  }
  next();
}