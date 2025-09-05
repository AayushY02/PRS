import 'dotenv/config';
import { z } from 'zod';

// Coerce number; default to Render's PORT if provided.
const EnvSchema = z.object({
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  COOKIE_NAME: z.string().default('auth_token'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(parseInt(process.env.PORT || '8080', 10)),
  // Accept comma-separated list: "http://localhost:5173,https://my-frontend.onrender.com"
  CORS_ORIGIN: z.string().default("http://localhost:5173, https://prs-pied.vercel.app/"),

}).transform((raw) => ({
  ...raw,
  CORS_ORIGINS: raw.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
}));

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Pretty-print all missing/invalid keys
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  // Fail fast
  process.exit(1);
}

export const ENV = parsed.data;
/**
 * ENV fields:
 * - ENV.DATABASE_URL: string
 * - ENV.JWT_SECRET: string
 * - ENV.COOKIE_NAME: string
 * - ENV.NODE_ENV: 'development' | 'test' | 'production'
 * - ENV.PORT: number
 * - ENV.CORS_ORIGIN: string (original)
 * - ENV.CORS_ORIGINS: string[] (split list)
 */
