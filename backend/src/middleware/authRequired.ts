import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../env';
import { verifyJWT } from '../auth';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[ENV.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = verifyJWT(token);
    const userId = payload.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Load master flag for authorization decisions
    const [u] = await db
      .select({ id: schema.users.id, isMaster: schema.users.isMaster })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).userId = u.id;
    (req as any).isMaster = !!(u as any).isMaster;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
