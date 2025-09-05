import 'dotenv/config';
import { db, schema } from '../src/db';
import { eq } from 'drizzle-orm';

async function run() {
  // Regions
  const regions = [
    { code: 'kashiwa 001', name: 'Kashiwa 001' },
    { code: 'kashiwa 002', name: 'Kashiwa 002' }
  ];
  for (const r of regions) {
    await db.insert(schema.regions).values(r).onConflictDoNothing();
  }

  // Subareas for kashiwa 001
  const [r1] = await db.select().from(schema.regions).where(eq(schema.regions.code, 'kashiwa 001')).limit(1);
  if (r1) {
    const subs = [
      { regionId: r1.id, code: '001-1', name: 'Kashiwa 001-1', highlightImageUrl: '/assets/kashiwa/001/highlight-001-1.jpg' },
      { regionId: r1.id, code: '001-2', name: 'Kashiwa 001-2', highlightImageUrl: '/assets/kashiwa/001/highlight-001-2.jpg' }
    ];
    for (const s of subs) {
      await db.insert(schema.subareas).values(s).onConflictDoNothing();
    }

    const [sa1] = await db.select().from(schema.subareas).where(eq(schema.subareas.code, '001-1')).limit(1);
    const [sa2] = await db.select().from(schema.subareas).where(eq(schema.subareas.code, '001-2')).limit(1);

    if (sa1) {
      await db.insert(schema.spots).values([
        { subareaId: sa1.id, code: 'A-01', description: 'Near pole' },
        { subareaId: sa1.id, code: 'A-02', description: 'Corner' }
      ]).onConflictDoNothing();
    }
    if (sa2) {
      await db.insert(schema.spots).values([
        { subareaId: sa2.id, code: 'B-01', description: 'Mid-block' },
        { subareaId: sa2.id, code: 'B-02', description: 'Near hydrant' }
      ]).onConflictDoNothing();
    }
  }

  console.log('Seeded.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
