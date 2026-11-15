# IgnisGuard backend (FastAPI + MySQL + H3)

1. `cp .env.example .env` y completar `FIRMS_MAP_KEY` (y `DATABASE_URL` si difiere del default).
2. `sudo docker compose up -d mysql` (publica MySQL en `localhost:3307`; el `-sudo` es por el permiso del socket de Docker).
3. `pip install -r requirements.txt`
4. `python etl/build_regions.py` → genera `data/regiones.geojson` (límites provinciales → 7 regiones).
5. Sembrar la tabla `region`: `mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 ignisguard < seed.sql`
6. Descargar datos: `python etl/download_firms.py W,S,E,N AAAA-MM-DD AAAA-MM-DD`
   - El bbox es `oeste,sur,este,norte` y define qué regiones cubre el ETL (hay que correrlo por zona; el script mergea y deduplica CSVs existentes).
   - La API de FIRMS acepta máx. 5 días por request; el script ya itera en bloques.
7. `python etl/harmonize.py && python etl/load_mysql.py`
8. `uvicorn app.main:app --reload` -> http://localhost:8000/docs
