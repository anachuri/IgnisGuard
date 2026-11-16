"""Backfill histórico con los archivos anuales por país de FIRMS.

El endpoint /api/area/csv acepta máx. 5 días por request, así que para la
serie de 20 años conviene descargar los CSV anuales públicos:

  https://firms.modaps.eosdis.nasa.gov/data/country/{producto}/{año}/{producto}_{año}_{Pais}.csv

Productos disponibles: modis (Terra+Aqua, 2000+) y viirs-snpp (SNPP 375 m,
2012+). NOAA-20/21 no están en el archivo anual: su cobertura llega por
download_firms.py (SP/NRT).

Uso:
  python etl/backfill_archive.py --from 2007 --to 2025
  python etl/backfill_archive.py --from 2020 --to 2020 --products modis
  (al terminar correr harmonize.py + load_mysql.py, o pasar --load)
"""
import argparse
import datetime as dt
import io
import os
import sys

import pandas as pd
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from download_firms import KEY_COLS, save  # noqa: E402  (dedup + merge)

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
PRODUCTS = {
    "modis": {"first_year": 2000, "target": "data/modis.csv"},
    "viirs-snpp": {"first_year": 2012, "target": "data/viirs.csv"},
}
KEEP_COLS = [c for c in KEY_COLS if c != "collection"]


def fetch_year(product: str, year: int, country: str) -> pd.DataFrame:
    url = f"{BASE}/{product}/{year}/{product}_{year}_{country}.csv"
    response = requests.get(url, timeout=600)
    if response.status_code == 404:
        return pd.DataFrame()
    response.raise_for_status()
    df = pd.read_csv(
        io.StringIO(response.text), dtype={"acq_time": str, "version": str}
    )
    cols = [c for c in KEEP_COLS if c in df.columns]
    return df[cols]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="year_from", type=int, default=2007)
    parser.add_argument("--to", dest="year_to", type=int,
                        default=dt.date.today().year - 1)
    parser.add_argument("--country", default="Argentina")
    parser.add_argument("--products", default="modis,viirs-snpp",
                        help="lista separada por comas")
    parser.add_argument("--load", action="store_true",
                        help="al terminar corre harmonize.py + load_mysql.py")
    args = parser.parse_args()

    by_target: dict[str, list[pd.DataFrame]] = {}
    for product in args.products.split(","):
        product = product.strip()
        info = PRODUCTS.get(product)
        if not info:
            print(f"producto desconocido: {product}")
            continue
        for year in range(max(info["first_year"], args.year_from),
                          args.year_to + 1):
            df = fetch_year(product, year, args.country)
            print(f"  {product:12s} {year}: {len(df)} filas", flush=True)
            if not df.empty:
                by_target.setdefault(info["target"], []).append(df)

    for target, frames in by_target.items():
        merged = pd.concat(frames, ignore_index=True)
        save(merged, target)
        print(f"{target}: +{len(merged)} filas (merge+dedup)")

    if args.load:
        import subprocess
        here = os.path.dirname(os.path.abspath(__file__))
        backend = os.path.dirname(here)
        subprocess.run([sys.executable, os.path.join(here, "harmonize.py")],
                       check=True, cwd=backend)
        subprocess.run([sys.executable, os.path.join(here, "load_mysql.py")],
                       check=True, cwd=backend)
    return 0


if __name__ == "__main__":
    sys.exit(main())
