"""Descarga detecciones FIRMS por bounding box en bloques de 10 días.
Uso: FIRMS_MAP_KEY=xxx python etl/download_firms.py W,S,E,N 2012-01-01 2012-12-31
Fuentes: MODIS_SP (archivo), VIIRS_SNPP_SP (archivo). Para datos recientes: *_NRT.
"""
import os, sys, io, datetime as dt
import requests, pandas as pd

KEY = os.environ["FIRMS_MAP_KEY"]
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

def fetch(source, bbox, start, end):
    frames, d = [], start
    while d <= end:
        n = min(10, (end - d).days + 1)
        url = f"{BASE}/{KEY}/{source}/{bbox}/{n}/{d.isoformat()}"
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        if r.text.strip() and not r.text.startswith("Invalid"):
            frames.append(pd.read_csv(io.StringIO(r.text), dtype={"acq_time": str}))
        d += dt.timedelta(days=n)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

if __name__ == "__main__":
    bbox, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    start, end = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
    os.makedirs("data", exist_ok=True)
    fetch("MODIS_SP", bbox, start, end).to_csv("data/modis.csv", index=False)
    fetch("VIIRS_SNPP_SP", bbox, start, end).to_csv("data/viirs.csv", index=False)
