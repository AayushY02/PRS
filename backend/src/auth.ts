import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ENV } from './env';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';

export const AuthPayload = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function createUser(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  try {
    const [row] = await db
      .insert(schema.users)
      .values({ email, passwordHash: hash })
      .returning({ id: schema.users.id });
    return row;
  } catch (e: any) {
    // unique violation on email
    if (e?.code === '23505') return null;
    throw e;
  }
}

export async function verifyUser(email: string, password: string) {
  const [user] = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user.id : null;
}

export function signJWT(userId: string) {
  return jwt.sign({ sub: userId }, ENV.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyJWT(token: string) {
  return jwt.verify(token, ENV.JWT_SECRET) as { sub: string; iat: number; exp: number };
}
