import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL", "mysql+pymysql://root:root@localhost:3306/ignisguard"))
df = pd.read_parquet("out/fire_cell_day.parquet")
df.to_sql("fire_cell_day", engine, if_exists="append",
          index=False, chunksize=10_000, method="multi")

rd = (df.groupby(["region_id", "fecha"])
        .agg(n_cells=("cell", "count"), frp_sum=("frp_sum", "sum"))
        .reset_index())
rd.to_sql("region_day", engine, if_exists="append", index=False)
