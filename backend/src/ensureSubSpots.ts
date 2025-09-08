import { eq } from 'drizzle-orm';
import { subSpots } from './schema';
import { db } from './db';

export async function ensureSubSpots(spotId: string, desired: number, baseCode: string) {
  const existing = await db.select().from(subSpots).where(eq(subSpots.spotId, spotId));
  const cur = existing.length;

  for (let i = cur + 1; i <= desired; i++) {
    const code = `${baseCode}-${String(i).padStart(2, '0')}`;
    await db.insert(subSpots).values({ spotId, idx: i, code }).onConflictDoNothing();
  }
}
