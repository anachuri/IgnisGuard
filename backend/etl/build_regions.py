"""Genera data/regiones.geojson para el ETL a partir de los límites
provinciales de Argentina (geojson público, una feature por provincia).

Regiones IgnisGuard (region_id debe coincidir con la tabla `region`):
  1 Jujuy              -> JUJUY
  2 Salta              -> SALTA
  3 Córdoba            -> CORDOBA
  4 Chaco              -> CHACO
  5 Misiones           -> MISIONES
  6 Patagonia          -> NEUQUEN + RIONEGRO
  7 Delta del Paraná   -> ENTRERIOS + SANTAFE

Uso: python etl/build_regions.py
"""
import json
import urllib.request
from pathlib import Path

BASE = (
    "https://raw.githubusercontent.com/"
    "alvarezgarcia/provincias-argentinas-geojson/master/{}.json"
)

REGIONS = {
    1: ("Jujuy", ["JUJUY"]),
    2: ("Salta", ["SALTA"]),
    3: ("Córdoba", ["CORDOBA"]),
    4: ("Chaco", ["CHACO"]),
    5: ("Misiones", ["MISIONES"]),
    6: ("Patagonia", ["NEUQUEN", "RIONEGRO"]),
    7: ("Delta del Paraná", ["ENTRERIOS", "SANTAFE"]),
}

OUT = Path("data/regiones.geojson")


def fetch(province: str) -> dict:
    with urllib.request.urlopen(BASE.format(province), timeout=60) as r:
        return json.load(r)


def main() -> None:
    features = []
    for region_id, (name, provinces) in REGIONS.items():
        for province in provinces:
            data = fetch(province)
            for feature in data["features"]:
                feature["properties"] = {"region_id": region_id, "name": name}
                features.append(feature)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}),
        encoding="utf-8",
    )
    print(f"{OUT}: {len(features)} features, {len(REGIONS)} regiones")


if __name__ == "__main__":
    main()
