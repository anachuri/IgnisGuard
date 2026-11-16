"""Helpers geoespaciales para consultas por punto (lat, lon).

Permiten usar la API con ubicaciones arbitrarias del mundo, no solo con las
regiones precargadas: los endpoints aceptan `lat`/`lon` como alternativa a
`region` y filtran por un bounding box alrededor del punto.
"""
import math

from fastapi import HTTPException

# Radio aproximado de análisis alrededor de un punto arbitrario (~65 km).
GEO_DELTA_DEG = 0.6

# Half-size del bbox para descargas FIRMS alrededor de un punto (~90 km).
POINT_BBOX_DELTA_DEG = 0.8


def geo_clause(lat: float, lon: float) -> tuple[str, dict]:
    """WHERE + params para filtrar celdas dentro del bbox del punto."""
    dlat = GEO_DELTA_DEG
    dlon = GEO_DELTA_DEG / max(0.2, abs(math.cos(math.radians(lat))))
    return (
        "lat BETWEEN :minlat AND :maxlat AND lon BETWEEN :minlon AND :maxlon",
        {
            "minlat": lat - dlat,
            "maxlat": lat + dlat,
            "minlon": lon - dlon,
            "maxlon": lon + dlon,
        },
    )


def geo_filter(region: int | None, lat: float | None,
               lon: float | None) -> tuple[str, dict]:
    """Devuelve el WHERE adecuado según `region` o `lat`/`lon` (XOR)."""
    if region is not None and (lat is None and lon is None):
        return "region_id = :region", {"region": region}
    if region is None and lat is not None and lon is not None:
        clause, params = geo_clause(lat, lon)
        return f"({clause})", params
    raise HTTPException(
        status_code=400,
        detail="pasar `region` o el par `lat`/`lon` (no ambos)",
    )


def point_bbox(lat: float, lon: float) -> str:
    """BBox W,S,E,N alrededor del punto para la API de área de FIRMS."""
    dlat = POINT_BBOX_DELTA_DEG
    dlon = POINT_BBOX_DELTA_DEG / max(0.2, abs(math.cos(math.radians(lat))))
    return (f"{lon - dlon:.4f},{lat - dlat:.4f},"
            f"{lon + dlon:.4f},{lat + dlat:.4f}")
