import os, sys
import h3, pandas as pd, geopandas as gpd, numpy as np

RES = 8
TZ = "America/Argentina/Buenos_Aires"
RAW_FILES = {"MODIS": "data/modis.csv", "VIIRS": "data/viirs.csv"}
PARQUET_COLS = ["cell", "fecha", "n_modis", "n_viirs", "frp_max", "frp_sum",
                "agreement", "lat", "lon", "region_id"]

def load_modis(path):
    df = pd.read_csv(path, dtype={"acq_time": str})
    df["sensor"] = "MODIS"
    df["conf_cat"] = pd.cut(df["confidence"], [-1, 29, 79, 100],
                            labels=["l", "n", "h"]).astype(str)
    return df

def load_viirs(path):
    df = pd.read_csv(path, dtype={"acq_time": str})
    df["sensor"] = "VIIRS"
    df["conf_cat"] = df["confidence"].astype(str).str.lower().str[0]
    return df

def common_schema(df):
    t = df["acq_time"].str.zfill(4)
    ts = pd.to_datetime(df["acq_date"] + " " + t.str[:2] + ":" + t.str[2:],
                        utc=True)
    out = pd.DataFrame({
        "sensor": df["sensor"],
        "lat": df["latitude"], "lon": df["longitude"],
        "ts_utc": ts,
        "fecha": ts.dt.tz_convert(TZ).dt.date,   # día LOCAL
        "frp": df["frp"].astype(float),
        "conf_cat": df["conf_cat"],
    })
    return out[out["conf_cat"] != "l"]            # política: descartar low

def dedup_detections(raw):
    """Una misma detección puede venir en SP y NRT: prefiere SP (consolidado).
    Clave: satélite + posición (~11 m) + fecha + hora de adquisición."""
    if "collection" not in raw.columns:
        raw["collection"] = "SP"
    raw["collection"] = raw["collection"].fillna("SP")
    raw = raw.assign(
        _rank=raw["collection"].map({"SP": 0, "NRT": 1}).fillna(0),
        _lat=raw["latitude"].round(4),
        _lon=raw["longitude"].round(4),
    ).sort_values("_rank", kind="stable")
    return raw.drop_duplicates(
        subset=["satellite", "_lat", "_lon", "acq_date", "acq_time"],
        keep="first",
    ).drop(columns=["_rank", "_lat", "_lon"])

def to_cells(df):
    df["cell"] = [h3.latlng_to_cell(la, lo, RES)
                  for la, lo in zip(df["lat"], df["lon"])]
    return df

def aggregate(df):
    g = df.groupby(["cell", "fecha"])
    agg = g.agg(
        n_modis=("sensor", lambda s: (s == "MODIS").sum()),
        n_viirs=("sensor", lambda s: (s == "VIIRS").sum()),
        frp_max=("frp", "max"),
        frp_sum=("frp", "sum"),
    ).reset_index()
    agg["agreement"] = ((agg.n_modis > 0) & (agg.n_viirs > 0)).astype(int)
    centers = agg["cell"].map(h3.cell_to_latlng)
    agg["lat"] = centers.str[0]
    agg["lon"] = centers.str[1]
    return agg

def assign_region(agg, regions_geojson):
    regs = gpd.read_file(regions_geojson).to_crs(4326)   # polígonos de regiones
    pts = gpd.GeoDataFrame(agg,
            geometry=gpd.points_from_xy(agg.lon, agg.lat), crs=4326)
    joined = gpd.sjoin(pts, regs[["region_id", "geometry"]],
                       how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")]
    return pd.DataFrame(joined.drop(columns=["geometry", "index_right"]))

def load_raw():
    frames = []
    for sensor, path in RAW_FILES.items():
        if os.path.exists(path):
            frames.append(load_modis(path) if sensor == "MODIS"
                          else load_viirs(path))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

def write_empty():
    os.makedirs("out", exist_ok=True)
    pd.DataFrame(columns=PARQUET_COLS).to_parquet("out/fire_cell_day.parquet")

if __name__ == "__main__":
    raw = load_raw()
    if raw.empty:
        print("sin datos en data/*.csv -> parquet vacío")
        write_empty()
        sys.exit(0)

    raw = dedup_detections(raw)
    df = to_cells(common_schema(raw))
    agg = aggregate(df)

    if os.path.exists("data/regiones.geojson"):
        agg = assign_region(agg, "data/regiones.geojson")
    else:
        agg["region_id"] = np.nan
    agg = agg.dropna(subset=["region_id"])
    if not agg.empty:
        agg["region_id"] = agg["region_id"].astype(int)

    os.makedirs("out", exist_ok=True)
    agg[PARQUET_COLS].to_parquet("out/fire_cell_day.parquet")
    print(f"{len(agg)} filas -> out/fire_cell_day.parquet")
