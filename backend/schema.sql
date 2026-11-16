CREATE TABLE IF NOT EXISTS region (
  id SMALLINT PRIMARY KEY,
  name VARCHAR(80), lat DOUBLE PRECISION, lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS fire_cell_day (
  cell        CHAR(15)  NOT NULL,
  fecha       DATE      NOT NULL,
  n_modis     SMALLINT  NOT NULL DEFAULT 0,
  n_viirs     SMALLINT  NOT NULL DEFAULT 0,
  frp_max     DOUBLE PRECISION,
  frp_sum     DOUBLE PRECISION,
  agreement   BOOLEAN   NOT NULL DEFAULT FALSE,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  region_id   SMALLINT,
  PRIMARY KEY (cell, fecha)
);
CREATE INDEX IF NOT EXISTS idx_fecha ON fire_cell_day (fecha);
CREATE INDEX IF NOT EXISTS idx_region_fecha ON fire_cell_day (region_id, fecha);
CREATE INDEX IF NOT EXISTS idx_geo ON fire_cell_day (lat, lon, fecha);

CREATE TABLE IF NOT EXISTS region_day (
  region_id   SMALLINT NOT NULL,
  fecha       DATE NOT NULL,
  n_cells     INTEGER NOT NULL,
  frp_sum     DOUBLE PRECISION,
  PRIMARY KEY (region_id, fecha)
);
