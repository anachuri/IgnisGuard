import os, sys
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL", "mysql+pymysql://root:root@localhost:3306/ignisguard"))

path = "out/fire_cell_day.parquet"
if not os.path.exists(path):
    sys.exit("no hay parquet: corré etl/harmonize.py primero")

df = pd.read_parquet(path)
if df.empty:
    print("parquet vacío, nada que cargar")
    sys.exit(0)

# Idempotente y atómico: borra el rango de fechas del parquet y lo reinserta
# en una sola transacción (los GET de la API nunca ven datos a medias).
dmin, dmax = df["fecha"].min(), df["fecha"].max()

rd = (df.groupby(["region_id", "fecha"])
        .agg(n_cells=("cell", "count"), frp_sum=("frp_sum", "sum"))
        .reset_index())

with engine.begin() as conn:
    conn.execute(text("DELETE FROM fire_cell_day WHERE fecha BETWEEN :a AND :b"),
                 {"a": dmin, "b": dmax})
    conn.execute(text("DELETE FROM region_day WHERE fecha BETWEEN :a AND :b"),
                 {"a": dmin, "b": dmax})
    df.to_sql("fire_cell_day", conn, if_exists="append",
              index=False, chunksize=10_000, method="multi")
    rd.to_sql("region_day", conn, if_exists="append", index=False)

print(f"cargado {len(df)} cell-days ({dmin} -> {dmax}), "
      f"{len(rd)} region-days")
