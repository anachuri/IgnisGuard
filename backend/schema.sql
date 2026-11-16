CREATE TABLE IF NOT EXISTS region (
  id TINYINT PRIMARY KEY,
  name VARCHAR(80), lat DOUBLE, lon DOUBLE
);

CREATE TABLE IF NOT EXISTS fire_cell_day (
  cell        CHAR(15)  NOT NULL,
  fecha       DATE      NOT NULL,
  n_modis     SMALLINT  NOT NULL DEFAULT 0,
  n_viirs     SMALLINT  NOT NULL DEFAULT 0,
  frp_max     FLOAT,
  frp_sum     FLOAT,
  agreement   TINYINT(1) NOT NULL DEFAULT 0,
  lat         DOUBLE NOT NULL,
  lon         DOUBLE NOT NULL,
  region_id   TINYINT,
  PRIMARY KEY (cell, fecha),
  KEY idx_fecha (fecha),
  KEY idx_region_fecha (region_id, fecha),
  KEY idx_geo (lat, lon, fecha)
);

CREATE TABLE IF NOT EXISTS region_day (
  region_id   TINYINT NOT NULL,
  fecha       DATE NOT NULL,
  n_cells     INT NOT NULL,
  frp_sum     FLOAT,
  PRIMARY KEY (region_id, fecha)
);
