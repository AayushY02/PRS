import { eq, asc, sql } from 'drizzle-orm';
import { db, schema } from '../src/db';

// Map 1 -> A, 2 -> B, ... 27 -> AA
const letterForOrder = (order: number): string => {
  if (!Number.isFinite(order) || order <= 0) return '?';
  let n = Math.floor(order);
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
};

async function ensureColumns() {
  // Safe: add columns if they don't exist (run as two statements to satisfy Neon)
  await db.execute(sql.raw(`ALTER TABLE spots ADD COLUMN IF NOT EXISTS display_code TEXT`));
  await db.execute(sql.raw(`ALTER TABLE sub_spots ADD COLUMN IF NOT EXISTS display_code TEXT`));
}

async function run() {
  await ensureColumns();

  // 1) Fetch subareas to know their regions
  const subareas = await db.query.subareas.findMany({
    columns: { id: true, regionId: true, createdAt: true, code: true },
    orderBy: [asc(schema.subareas.regionId), asc(schema.subareas.createdAt), asc(schema.subareas.code), asc(schema.subareas.id)],
  });
  const subareaRegion = new Map<string, string>();
  for (const sa of subareas) {
    subareaRegion.set(sa.id, sa.regionId);
  }

  // 2) Fetch all spots with stable ordering
  const spots = await db.query.spots.findMany({
    columns: { id: true, subareaId: true, createdAt: true, code: true },
    orderBy: [asc(schema.spots.createdAt), asc(schema.spots.code), asc(schema.spots.id)],
  });

  // 3) Assign display codes per region (keeps letters stable across all subareas in a region)
  const spotDisplayMap = new Map<string, string>();
  const byRegion = new Map<string, typeof spots>();
  for (const s of spots) {
    const regionId = subareaRegion.get(s.subareaId);
    if (!regionId) continue;
    if (!byRegion.has(regionId)) byRegion.set(regionId, []);
    byRegion.get(regionId)!.push(s);
  }
  for (const list of byRegion.values()) {
    list
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.code.localeCompare(b.code))
      .forEach((s, idx) => {
        const letter = letterForOrder(idx + 1);
        const display = `スポット${letter}`;
        spotDisplayMap.set(s.id, display);
      });
  }

  // 4) Persist spot display codes
  for (const [id, display] of spotDisplayMap.entries()) {
    await db.update(schema.spots).set({ displayCode: display }).where(eq(schema.spots.id, id));
  }

  // 5) Fetch sub-spots with parent display codes
  const subSpots = await db.query.subSpots.findMany({
    columns: { id: true, spotId: true, idx: true },
    orderBy: [asc(schema.subSpots.spotId), asc(schema.subSpots.idx), asc(schema.subSpots.id)],
  });

  // 6) Persist sub-spot display codes using parent display + idx
  for (const ss of subSpots) {
    const parentDisplay = spotDisplayMap.get(ss.spotId) ?? 'スポット?';
    const label = `${parentDisplay} · ${ss.idx}台目`;
    await db.update(schema.subSpots).set({ displayCode: label }).where(eq(schema.subSpots.id, ss.id));
  }

  console.log(`Updated ${spotDisplayMap.size} spots and ${subSpots.length} sub-spots with display_code.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
