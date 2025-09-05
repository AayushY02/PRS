-- Regions
INSERT INTO regions (code, name) VALUES
  ('kashiwa 001', 'Kashiwa 001'),
  ('kashiwa 002', 'Kashiwa 002')
ON CONFLICT (code) DO NOTHING;

-- Subareas for kashiwa 001
WITH r AS (SELECT id FROM regions WHERE code = 'kashiwa 001')
INSERT INTO subareas (region_id, code, name, highlight_image_url)
VALUES
  ((SELECT id FROM r), '001-1', 'Kashiwa 001-1', '/assets/kashiwa/001/highlight-001-1.jpg'),
  ((SELECT id FROM r), '001-2', 'Kashiwa 001-2', '/assets/kashiwa/001/highlight-001-2.jpg')
ON CONFLICT DO NOTHING;

-- Spots under subareas
WITH s1 AS (SELECT id FROM subareas WHERE code = '001-1'),
     s2 AS (SELECT id FROM subareas WHERE code = '001-2')
INSERT INTO spots (subarea_id, code, description) VALUES
  ((SELECT id FROM s1), 'A-01', 'Near pole'),
  ((SELECT id FROM s1), 'A-02', 'Corner'),
  ((SELECT id FROM s2), 'B-01', 'Mid-block'),
  ((SELECT id FROM s2), 'B-02', 'Near hydrant')
ON CONFLICT DO NOTHING;
