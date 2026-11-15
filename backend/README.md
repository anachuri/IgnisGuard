# OrbiTag backend (FastAPI + MySQL + H3)

1. `docker compose up -d mysql`
2. `pip install -r requirements.txt`
3. Descargar datos: `FIRMS_MAP_KEY=xxx python etl/download_firms.py -66,-25,-64,-23 2012-01-01 2012-12-31`
4. Poner `data/regiones.geojson` (columna `region_id`) y cargar la tabla `region`.
5. `python etl/harmonize.py && python etl/load_mysql.py`
6. `uvicorn app.main:app --reload` -> http://localhost:8000/docs
