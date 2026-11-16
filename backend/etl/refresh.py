"""Refresh incremental del pipeline FIRMS -> harmonize -> PostgreSQL.

Baja solo los días nuevos (SP consolidado + NRT para los más recientes),
reprocesa y recarga de forma idempotente. Se puede usar como cron job.

Uso:
  python etl/refresh.py --bbox=W,S,E,N [--bbox=W,S,E,N ...]
  python etl/refresh.py --from 2012-01-01 --to 2026-11-14 --bbox=W,S,E,N
  python etl/refresh.py --skip-load --bbox=W,S,E,N   # solo CSVs + parquet

Sin --from/--to arranca desde la última fecha cargada en PostgreSQL
(o el máximo acq_date de los CSVs) y re-descarga --overlap días por
si FIRMS publica correcciones (el dedup absorbe los repetidos).
"""
import argparse
import datetime as dt
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND / "etl"))

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

import download_firms

load_dotenv()
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/ignisguard"
)


def db_max_fecha():
    try:
        eng = create_engine(DATABASE_URL)
        with eng.connect() as conn:
            v = conn.execute(
                text("SELECT MAX(fecha) FROM fire_cell_day")
            ).scalar()
        if not v:
            return None
        return v.date() if isinstance(v, dt.datetime) else v
    except Exception as exc:
        print(f"aviso: PostgreSQL no disponible ({exc.__class__.__name__}), "
              "uso los CSVs como referencia")
        return None


def csv_max_fecha():
    mx = None
    for path in ("data/modis.csv", "data/viirs.csv"):
        if not os.path.exists(path):
            continue
        s = pd.read_csv(path, usecols=["acq_date"])["acq_date"]
        m = pd.to_datetime(s, errors="coerce").max()
        if pd.notna(m) and (mx is None or m > mx):
            mx = m
    return mx.date() if mx is not None else None


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--bbox", action="append", default=[],
                    metavar="W,S,E,N", help="repetible; usar = por el signo menos")
    ap.add_argument("bboxes", nargs="*",
                    help="alternativa posicional (poner -- antes si empiezan con -)")
    ap.add_argument("--from", dest="frm", help="AAAA-MM-DD inicial")
    ap.add_argument("--to", dest="to", help="AAAA-MM-DD final (default: hoy)")
    ap.add_argument("--sp-lag", type=int, default=download_firms.SP_LAG_DAYS,
                    help="días de atraso del producto SP (default 10)")
    ap.add_argument("--overlap", type=int, default=download_firms.OVERLAP_DAYS,
                    help="días de re-descarga en modo incremental")
    ap.add_argument("--skip-load", action="store_true",
                    help="no escribe en PostgreSQL")
    args = ap.parse_args()
    bboxes = args.bbox + args.bboxes
    if not bboxes:
        ap.error("falta al menos un bbox (--bbox=W,S,E,N)")

    today = dt.date.today()
    end = dt.date.fromisoformat(args.to) if args.to else today

    if args.frm:
        start = dt.date.fromisoformat(args.frm)
    else:
        last = db_max_fecha() or csv_max_fecha()
        if last is None:
            sys.exit("No hay datos previos: usá --from AAAA-MM-DD "
                     "o etl/download_firms.py primero")
        start = min(last - dt.timedelta(days=args.overlap), end)

    sp_end = min(end, today - dt.timedelta(days=args.sp_lag))
    nrt_start = max(sp_end + dt.timedelta(days=1), start) if sp_end < end else None

    print(f"rango {start} -> {end} | SP hasta {sp_end}"
          + (f" | NRT {nrt_start} -> {end}" if nrt_start else ""))

    for bbox in bboxes:
        download_firms.download([bbox], start, end, nrt_start=nrt_start)

    subprocess.run([sys.executable, "etl/harmonize.py"], check=True)
    if not args.skip_load:
        subprocess.run([sys.executable, "etl/load_db.py"], check=True)


if __name__ == "__main__":
    main()
