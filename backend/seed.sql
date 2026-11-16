-- Semilla de la tabla `region` (debe coincidir con data/regiones.geojson
-- y con los nombres que usa el frontend para fusionar metadata).
-- Uso: psql -h127.0.0.1 -p5432 -U postgres -d ignisguard -f seed.sql

INSERT INTO region (id, name, lat, lon) VALUES
  (1, 'Jujuy',            -24.1858, -65.2995),
  (2, 'Salta',            -24.7821, -65.4232),
  (3, 'Córdoba',          -31.4201, -64.1888),
  (4, 'Chaco',            -27.4514, -58.9867),
  (5, 'Misiones',         -27.3671, -55.8961),
  (6, 'Patagonia',        -41.1335, -71.3103),
  (7, 'Delta del Paraná', -34.0000, -58.7500)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lon = EXCLUDED.lon;
