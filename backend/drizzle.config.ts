import dotenv from "dotenv";
import 'dotenv/config';
import type { Config } from 'drizzle-kit';
dotenv.config();


export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! }
} satisfies Config;
