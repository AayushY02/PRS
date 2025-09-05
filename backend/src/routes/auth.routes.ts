// import { Router } from 'express';
// import { AuthPayload, createUser, signJWT, verifyUser } from '../auth';
// import { ENV } from '../env';

// export const authRouter = Router();

// const setCookie = (res: any, token: string) => {
//   res.cookie(ENV.COOKIE_NAME, token, {
//     httpOnly: true,
//     secure: ENV.NODE_ENV === 'production',
//     sameSite: 'lax',
//     path: '/',
//     maxAge: 7 * 24 * 3600 * 1000
//   });
// };

// authRouter.post('/signup', async (req, res) => {
//   const parse = AuthPayload.safeParse(req.body);
//   if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

//   const created = await createUser(parse.data.email, parse.data.password);
//   if (!created) return res.status(409).json({ error: 'Email already in use' });

//   const token = signJWT(created.id);
//   setCookie(res, token);
//   res.json({ ok: true, user: { id: created.id, email: parse.data.email } });
// });

// authRouter.post('/login', async (req, res) => {
//   const parse = AuthPayload.safeParse(req.body);
//   if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

//   const userId = await verifyUser(parse.data.email, parse.data.password);
//   if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

//   const token = signJWT(userId);
//   setCookie(res, token);
//   res.json({ ok: true, user: { id: userId, email: parse.data.email } });
// });

// authRouter.post('/logout', (req, res) => {
//   res.clearCookie(ENV.COOKIE_NAME, { path: '/' });
//   res.json({ ok: true });
// });

// authRouter.get('/me', (req, res) => {
//   const token = req.cookies[ENV.COOKIE_NAME];
//   if (!token) return res.json({ user: null });
//   try {
//     const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
//     res.json({ user: { id: payload.sub } });
//   } catch {
//     res.json({ user: null });
//   }
// });


import { Router, type Request, type Response } from 'express';
import { AuthPayload, createUser, signJWT, verifyUser } from '../auth';
import { ENV } from '../env';
import { db, schema } from '../db'; // << add this
import { eq } from 'drizzle-orm';   // << add this

export const authRouter = Router();

const isProd = ENV.NODE_ENV === 'production';

const setCookie = (res: any, token: string) => {
  res.cookie(ENV.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // << 1 hour in ms
  });
};

authRouter.post('/signup', async (req: Request, res: Response) => {
  const parse = AuthPayload.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const created = await createUser(parse.data.email, parse.data.password);
  if (!created) return res.status(409).json({ error: 'Email already in use' });

  const token = signJWT(created.id);
  setCookie(res, token);
  res.json({ ok: true, user: { id: created.id, email: parse.data.email } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parse = AuthPayload.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const userId = await verifyUser(parse.data.email, parse.data.password);
  if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signJWT(userId);
  setCookie(res, token);
  res.json({ ok: true, user: { id: userId, email: parse.data.email } });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(ENV.COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

/**
 * Return current user (id + email) if cookie is valid.
 * (No middleware: it’s fine to decode/lookup here.)
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies[ENV.COOKIE_NAME];
  if (!token) return res.json({ user: null });

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const sub = payload?.sub as string | undefined;
    if (!sub) return res.json({ user: null });

    const [u] = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, sub))
      .limit(1);

    if (!u) return res.json({ user: null });
    res.json({ user: u });
  } catch {
    res.json({ user: null });
  }
});
