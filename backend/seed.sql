-- Semilla de la tabla `region` (debe coincidir con data/regiones.geojson
-- y con los nombres que usa el frontend para fusionar metadata).
-- Uso: mysql -uroot -proot --default-character-set=utf8mb4 ignisguard < seed.sql
--   (el charset evita que los acentos queden doble-codificados)
--   contra docker: mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 ignisguard < seed.sql

INSERT INTO region (id, name, lat, lon) VALUES
  (1, 'Jujuy',            -24.1858, -65.2995),
  (2, 'Salta',            -24.7821, -65.4232),
  (3, 'Córdoba',          -31.4201, -64.1888),
  (4, 'Chaco',            -27.4514, -58.9867),
  (5, 'Misiones',         -27.3671, -55.8961),
  (6, 'Patagonia',        -41.1335, -71.3103),
  (7, 'Delta del Paraná', -34.0000, -58.7500)
ON DUPLICATE KEY UPDATE name = VALUES(name), lat = VALUES(lat), lon = VALUES(lon);
