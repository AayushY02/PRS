import 'dotenv/config';
import { db, schema } from '../db';
import { inArray } from 'drizzle-orm';

type RegionBlueprint = {
  code: string;
  name: string;
  spotCount: number;
};

const regionBlueprints: RegionBlueprint[] = [
  { code: 'kukan-01', name: 'Kukan 01', spotCount: 5 },
  { code: 'kukan-02', name: 'Kukan 02', spotCount: 7 },
  { code: 'kukan-06', name: 'Kukan 06', spotCount: 3 },
  { code: 'kukan-07', name: 'Kukan 07', spotCount: 5 },
];

const pad2 = (value: number) => String(value).padStart(2, '0');

async function run() {
  if (regionBlueprints.length > 0) {
    await db
      .delete(schema.regions)
      .where(inArray(schema.regions.code, regionBlueprints.map(r => r.code)));
  }

  for (const blueprint of regionBlueprints) {
    const [region] = await db
      .insert(schema.regions)
      .values({ code: blueprint.code, name: blueprint.name })
      .returning({ id: schema.regions.id, code: schema.regions.code });

    if (!region) continue;

    const [subarea] = await db
      .insert(schema.subareas)
      .values({
        regionId: region.id,
        code: `${region.code}-SA-01`,
        name: `${blueprint.name} Area`,
        highlightImageUrl: null,
      })
      .returning({ id: schema.subareas.id });

    if (!subarea) continue;

    for (let spotIndex = 1; spotIndex <= blueprint.spotCount; spotIndex++) {
      const spotSuffix = pad2(spotIndex);
      const [spot] = await db
        .insert(schema.spots)
        .values({
          subareaId: subarea.id,
          code: `S${spotSuffix}`,
          description: `Spot ${spotIndex} for ${blueprint.name}`,
        })
        .returning({ id: schema.spots.id });

      if (!spot) continue;

      const baseCode = `${region.code}-S${spotSuffix}`;

      for (let subIndex = 1; subIndex <= 4; subIndex++) {
        await db.insert(schema.subSpots).values({
          spotId: spot.id,
          idx: subIndex,
          code: `${baseCode}-SS${pad2(subIndex)}`,
        });
      }
    }
  }

  console.log('Seeded regions, spots, and sub-spots according to blueprint.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
