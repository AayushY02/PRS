import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

async function ensureMaster(email: string, password: string) {
  const [existing] = await db
    .select({ id: schema.users.id, isMaster: schema.users.isMaster })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    if (!existing.isMaster) {
      await db.update(schema.users).set({ isMaster: true }).where(eq(schema.users.id, existing.id));
      console.log(`Promoted existing user ${email} to master.`);
    } else {
      console.log(`User ${email} is already master.`);
    }
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [row] = await db
    .insert(schema.users)
    .values({ email, passwordHash: hash, isMaster: true })
    .returning({ id: schema.users.id });
  console.log(`Created master user ${email} (id=${row?.id}).`);
}

async function run() {
  const email = process.env.MASTER_EMAIL?.trim() || 'master@prs.local';
  const password = process.env.MASTER_PASSWORD?.trim() || 'master1234';
  await ensureMaster(email, password);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

