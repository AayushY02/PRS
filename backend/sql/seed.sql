-- Reset the four target regions so they have the desired number of spots and sub-spots.
WITH deleted AS (
  DELETE FROM regions
  WHERE code IN ('kukan-01', 'kukan-02', 'kukan-06', 'kukan-07')
  RETURNING 1
),
region_blueprints AS (
  SELECT * FROM (VALUES
    ('kukan-01', 'Kukan 01', 5),
    ('kukan-02', 'Kukan 02', 7),
    ('kukan-06', 'Kukan 06', 3),
    ('kukan-07', 'Kukan 07', 5)
  ) AS rb(code, name, spot_count)
),
inserted_regions AS (
  INSERT INTO regions (code, name)
  SELECT rb.code, rb.name
  FROM region_blueprints rb
  RETURNING id, code, name
),
inserted_subareas AS (
  INSERT INTO subareas (region_id, code, name, highlight_image_url)
  SELECT r.id,
         r.code || '-SA-01',
         r.name || ' Area',
         NULL
  FROM inserted_regions r
  RETURNING id, region_id, code
),
spot_seed AS (
  SELECT r.id AS region_id,
         sa.id AS subarea_id,
         r.code,
         r.name,
         gs.spot_idx
  FROM inserted_regions r
  JOIN region_blueprints rb ON rb.code = r.code
  JOIN inserted_subareas sa ON sa.region_id = r.id
  JOIN generate_series(1, rb.spot_count) AS gs(spot_idx) ON TRUE
),
inserted_spots AS (
  INSERT INTO spots (subarea_id, code, description)
  SELECT s.subarea_id,
         'S' || lpad(s.spot_idx::text, 2, '0'),
         format('Spot %s for %s', s.spot_idx, s.name)
  FROM spot_seed s
  RETURNING id, subarea_id, code
)
INSERT INTO sub_spots (spot_id, idx, code)
SELECT sp.id,
       ss.idx,
       r.code || '-' || sp.code || '-SS' || lpad(ss.idx::text, 2, '0')
FROM inserted_spots sp
JOIN inserted_subareas sa ON sp.subarea_id = sa.id
JOIN inserted_regions r ON sa.region_id = r.id
JOIN generate_series(1, 4) AS ss(idx) ON TRUE;
