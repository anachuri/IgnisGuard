"""Descarga detecciones FIRMS por bounding box.

Uso:
  python etl/download_firms.py W,S,E,N AAAA-MM-DD AAAA-MM-DD

La API de área/csv acepta máx. 5 días por request; el script itera en bloques.
Fuentes SP (producto consolidado) hasta hoy-SP_LAG_DAYS; fuentes NRT para los
días recientes. Los CSVs en data/ se mergean y deduplican en cada corrida,
 así que es seguro ejecutarlo varias veces con distintos bboxes.

También usable como módulo (lo usa etl/refresh.py):
  download(bboxes, start, end, nrt_start)
"""
import os, sys, io, datetime as dt
import requests, pandas as pd
from dotenv import load_dotenv

load_dotenv()

KEY = os.environ["FIRMS_MAP_KEY"]
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

SP_LAG_DAYS = 10    # el producto SP consolida con ~10 días de atraso
OVERLAP_DAYS = 30   # margen de re-descarga en refresh (el dedup lo absorbe)

SP_SOURCES = ["MODIS_SP", "VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "VIIRS_NOAA21_SP"]
NRT_SOURCES = ["MODIS_NRT", "VIIRS_SNPP_NRT",
               "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]

KEY_COLS = ["collection", "latitude", "longitude", "acq_date", "acq_time",
            "satellite", "confidence", "frp"]


def target_csv(source):
    return "data/modis.csv" if source.startswith("MODIS") else "data/viirs.csv"


def fetch(source, bbox, start, end):
    frames, d = [], start
    while d <= end:
        n = min(5, (end - d).days + 1)
        url = f"{BASE}/{KEY}/{source}/{bbox}/{n}/{d.isoformat()}"
        r = requests.get(url, timeout=120)
        if not r.ok:
            body = r.text.strip()[:200]
            if "MAP_KEY" in body:
                raise SystemExit(f"FIRMS {r.status_code}: {body}")
            print(f"  aviso {source} {d}: HTTP {r.status_code} {body}")
            d += dt.timedelta(days=n)
            continue
        text = r.text.strip()
        if text.startswith("latitude"):      # solo parsear si hay header CSV
            frames.append(pd.read_csv(io.StringIO(text), dtype={"acq_time": str}))
        d += dt.timedelta(days=n)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def save(df, path):
    """Mergea con el CSV existente y deduplica por detección."""
    os.makedirs("data", exist_ok=True)
    if df.empty:
        return
    if os.path.exists(path):
        old = pd.read_csv(path, dtype={"acq_time": str, "version": str})
        df = pd.concat([old, df], ignore_index=True)
    if "collection" not in df.columns:
        df["collection"] = "SP"
    df["collection"] = df["collection"].fillna("SP")
    cols = [c for c in KEY_COLS if c in df.columns]
    df.drop_duplicates(subset=cols, keep="first").to_csv(path, index=False)


def download_range(bbox, start, end, sources):
    for source in sources:
        df = fetch(source, bbox, start, end)
        if not df.empty:
            df["collection"] = "NRT" if "_NRT" in source else "SP"
            save(df, target_csv(source))
        print(f"  {source:20s} {start} -> {end}: {len(df)} filas")


def download(bboxes, start, end, nrt_start=None):
    """SP para [start, nrt_start-1]; NRT para [nrt_start, end].
    nrt_start=None -> todo SP."""
    for bbox in bboxes:
        print(f"bbox {bbox} · {start} -> {end}")
        sp_end = end if nrt_start is None else min(end, nrt_start - dt.timedelta(days=1))
        if start <= sp_end:
            download_range(bbox, start, sp_end, SP_SOURCES)
        if nrt_start and nrt_start <= end:
            download_range(bbox, max(nrt_start, start), end, NRT_SOURCES)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    bbox, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    start, end = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
    tail = dt.date.today() - dt.timedelta(days=SP_LAG_DAYS) + dt.timedelta(days=1)
    nrt_start = tail if end >= tail else None
    download([bbox], start, end, nrt_start=nrt_start)
