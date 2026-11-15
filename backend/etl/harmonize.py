import h3, pandas as pd, geopandas as gpd, numpy as np

RES = 8
TZ = "America/Argentina/Buenos_Aires"

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

if __name__ == "__main__":
    frames = [common_schema(load_modis(p)) for p in ["data/modis.csv"]] + \
             [common_schema(load_viirs(p)) for p in ["data/viirs.csv"]]
    df = to_cells(pd.concat(frames, ignore_index=True))
    agg = assign_region(aggregate(df), "data/regiones.geojson")
    agg = agg.dropna(subset=["region_id"])
    agg["region_id"] = agg["region_id"].astype(int)
    agg.to_parquet("out/fire_cell_day.parquet")
