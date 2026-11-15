"""Descarga detecciones FIRMS por bounding box en bloques de 5 días
(el máximo que acepta la API de área/csv es day_range=5).
Uso: FIRMS_MAP_KEY=xxx python etl/download_firms.py W,S,E,N 2012-01-01 2012-12-31
Fuentes: MODIS_SP (archivo), VIIRS_SNPP_SP (archivo). Para datos recientes: *_NRT.
"""
import os, sys, io, datetime as dt
import requests, pandas as pd
from dotenv import load_dotenv

load_dotenv()

KEY = os.environ["FIRMS_MAP_KEY"]
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

def fetch(source, bbox, start, end):
    frames, d = [], start
    while d <= end:
        n = min(5, (end - d).days + 1)
        url = f"{BASE}/{KEY}/{source}/{bbox}/{n}/{d.isoformat()}"
        r = requests.get(url, timeout=120)
        if not r.ok:
            raise SystemExit(f"FIRMS {r.status_code} en {source} {d}: {r.text.strip()[:200]}")
        if r.text.strip() and not r.text.startswith("Invalid"):
            frames.append(pd.read_csv(io.StringIO(r.text), dtype={"acq_time": str}))
        d += dt.timedelta(days=n)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

KEY_COLS = ["latitude", "longitude", "acq_date", "acq_time",
            "satellite", "confidence", "frp"]

def save(df, path):
    """Escribe/mergea el CSV: si ya existe, concatena y deduplica por detección."""
    os.makedirs("data", exist_ok=True)
    if df.empty:
        return
    if os.path.exists(path):
        old = pd.read_csv(path, dtype={"acq_time": str})
        df = pd.concat([old, df], ignore_index=True)
    df.drop_duplicates(subset=[c for c in KEY_COLS if c in df.columns],
                       keep="first").to_csv(path, index=False)

if __name__ == "__main__":
    bbox, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    start, end = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
    save(fetch("MODIS_SP", bbox, start, end), "data/modis.csv")
    save(fetch("VIIRS_SNPP_SP", bbox, start, end), "data/viirs.csv")
