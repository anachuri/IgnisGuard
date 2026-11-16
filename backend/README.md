# IgnisGuard backend (FastAPI + MySQL + H3)

1. `cp .env.example .env` y completar `FIRMS_MAP_KEY`, `METEOMATICS_USERNAME` y `METEOMATICS_PASSWORD` (y `DATABASE_URL` si difiere del default).
2. `sudo docker compose up -d mysql` (publica MySQL en `localhost:3307`; el `-sudo` es por el permiso del socket de Docker).
3. `pip install -r requirements.txt`
4. `python etl/build_regions.py` → genera `data/regiones.geojson` (límites provinciales → 7 regiones).
5. Sembrar la tabla `region`: `mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 ignisguard < seed.sql`
6. Carga inicial o por rango: `python etl/refresh.py --from 2012-01-01 --bbox=W,S,E,N`
   - Acepta varios `--bbox=W,S,E,N` (correr por zona: los polígonos de `regiones.geojson` definen la región de cada detección, el bbox solo limita la descarga).
   - SP (consolidado) hasta hace ~10 días; NRT (VIIRS SNPP/NOAA-20/NOAA-21 + MODIS) para los días recientes.
   - Al final corre `harmonize.py` + `load_mysql.py` automáticamente (`--skip-load` para saltearlo).
7. `uvicorn app.main:app --reload` -> http://localhost:8000/docs

## Clima y pronóstico (Meteomatics)

- `GET /api/weather?region=3&date=2026-11-20` devuelve temperatura, humedad, viento y precipitación reales para el centroide de la región.
- `GET /api/forecast?region=3&date=2026-11-20` devuelve una probabilidad de incendio y los drivers meteorológicos. Es un modelo heurístico transparente (`heuristic-v0`), no un XGBoost entrenado; el front lo usa para la tarjeta de fechas futuras y cae al mock local si Meteomatics no responde.
- Las credenciales se leen de `.env`; nunca se exponen al navegador.

## Refresh incremental (cron)

`python etl/refresh.py --bbox=...` sin `--from/--to` descarga solo desde la
última fecha en MySQL (re-descarga 30 días de overlap por correcciones de FIRMS;
el dedup lo absorbe). Ejemplo semanal:

```cron
0 6 * * 0  cd /home/anachuri/my_projects/IgnisGuard/backend && python3 etl/refresh.py --bbox=-66,-26,-63,-21 --bbox=-66,-30,-59,-24 --bbox=-60,-34,-54,-26 --bbox=-72,-42,-66,-38 >> etl/refresh.log 2>&1
```

Notas del pipeline:
- `download_firms.py` también sirve standalone: `python etl/download_firms.py W,S,E,N AAAA-MM-DD AAAA-MM-DD` (SP+NRT automático en la cola reciente). Los CSVs en `data/` se mergean y deduplican.
- `load_mysql.py` es idempotente: borra el rango de fechas del parquet y lo reinserta; se puede re-correr sin duplicar.
- `harmonize.py` deduplica detecciones SP/NRT a nivel fila (prefiere SP) antes de agregar por celda H3.
