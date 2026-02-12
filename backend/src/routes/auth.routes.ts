


import { Router, type Request, type Response } from 'express';
import { AuthPayload, createRefreshToken, revokeRefreshToken, rotateRefreshToken, signJWT, verifyJWT, verifyUser } from '../auth';
import { ENV } from '../env';
import { db, schema } from '../db'; // << add this
import { eq } from 'drizzle-orm';   // << add this
import { authOptional } from '../middleware/authOptional';

export const authRouter = Router();

const isProd = ENV.NODE_ENV === 'production';

const parseDurationMs = (value: string): number => {
  const trimmed = value.trim();
  const m = /^(\d+)([smhd])?$/.exec(trimmed);
  if (!m) return 2 * 60 * 60 * 1000;
  const amount = Number(m[1]);
  const unit = m[2] ?? 's';
  switch (unit) {
    case 'd': return amount * 24 * 60 * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'm': return amount * 60 * 1000;
    case 's':
    default: return amount * 1000;
  }
};

const accessMaxAgeMs = parseDurationMs(ENV.ACCESS_TOKEN_TTL);
const refreshMaxAgeMs = ENV.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const setAccessCookie = (res: any, token: string) => {
  res.cookie(ENV.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: accessMaxAgeMs,
  });
};

const setRefreshCookie = (res: any, token: string) => {
  res.cookie(ENV.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: refreshMaxAgeMs,
  });
};

const clearAuthCookies = (res: any) => {
  res.clearCookie(ENV.COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  res.clearCookie(ENV.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
};

authRouter.post('/signup', async (req: Request, res: Response) => {
  const parse = AuthPayload.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const created = await createUser(parse.data.email, parse.data.password);
  if (!created) return res.status(409).json({ error: 'Email already in use' });

  const token = signJWT(created.id);
  const refresh = await createRefreshToken(created.id);
  setAccessCookie(res, token);
  setRefreshCookie(res, refresh.token);
  res.json({ ok: true, user: { id: created.id, email: parse.data.email } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parse = AuthPayload.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const userId = await verifyUser(parse.data.email, parse.data.password);
  if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signJWT(userId);
  const refresh = await createRefreshToken(userId);
  setAccessCookie(res, token);
  setRefreshCookie(res, refresh.token);
  res.json({ ok: true, user: { id: userId, email: parse.data.email } });
});

authRouter.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.[ENV.REFRESH_COOKIE_NAME];
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[ENV.REFRESH_COOKIE_NAME];
  if (!refreshToken) return res.status(401).json({ error: 'Unauthorized' });

  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = signJWT(rotated.record.userId);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, rotated.token);

  res.json({ ok: true });
});

/**
 * Return current user (id + email) if cookie is valid.
 * (No middleware: it’s fine to decode/lookup here.)
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies[ENV.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = verifyJWT(token);
    const sub = payload?.sub as string | undefined;
    if (!sub) return res.status(401).json({ error: 'Unauthorized' });

    const [u] = await db
      .select({ id: schema.users.id, email: schema.users.email, isMaster: schema.users.isMaster })
      .from(schema.users)
      .where(eq(schema.users.id, sub))
      .limit(1);

    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: u });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

authRouter.get('/whoami', authOptional, async (req: Request, res: Response) => {
  let userId = (req as any).userId ?? null;
  if (!userId) {
    const refreshToken = req.cookies?.[ENV.REFRESH_COOKIE_NAME];
    if (refreshToken) {
      const rotated = await rotateRefreshToken(refreshToken);
      if (rotated) {
        const accessToken = signJWT(rotated.record.userId);
        setAccessCookie(res, accessToken);
        setRefreshCookie(res, rotated.token);
        userId = rotated.record.userId;
      }
    }
  }
  if (!userId) return res.json({ userId: null, isMaster: false });
  try {
    const [u] = await db
      .select({ id: schema.users.id, isMaster: schema.users.isMaster })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!u) return res.json({ userId: null, isMaster: false });
    res.json({ userId: u.id, isMaster: !!u.isMaster });
  } catch {
    res.json({ userId: null, isMaster: false });
  }
});

// NOTE: /me is handled above (auth-required).

