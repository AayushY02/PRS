import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
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
  const expiresIn = ENV.ACCESS_TOKEN_TTL as Exclude<SignOptions['expiresIn'], undefined>;
  return jwt.sign({ sub: userId }, ENV.JWT_SECRET as Secret, { expiresIn });
}

export function verifyJWT(token: string) {
  return jwt.verify(token, ENV.JWT_SECRET) as { sub: string; iat: number; exp: number };
}

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate(): Date {
  const days = ENV.REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createRefreshToken(userId: string) {
  const token = randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = refreshExpiryDate();

  const [row] = await db
    .insert(schema.refreshTokens)
    .values({ userId, tokenHash, expiresAt })
    .returning({ id: schema.refreshTokens.id, expiresAt: schema.refreshTokens.expiresAt });

  return { token, record: row as RefreshTokenRecord };
}

export async function rotateRefreshToken(token: string) {
  const tokenHash = hashToken(token);

  const [existing] = await db
    .select({
      id: schema.refreshTokens.id,
      userId: schema.refreshTokens.userId,
      expiresAt: schema.refreshTokens.expiresAt,
      revokedAt: schema.refreshTokens.revokedAt,
    })
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existing) return null;
  if (existing.revokedAt) return null;
  if (existing.expiresAt.getTime() <= Date.now()) return null;

  const { token: newToken, record } = await createRefreshToken(existing.userId);

  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date(), replacedBy: record.id })
    .where(eq(schema.refreshTokens.id, existing.id));

  return { token: newToken, record };
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.tokenHash, tokenHash));
}
