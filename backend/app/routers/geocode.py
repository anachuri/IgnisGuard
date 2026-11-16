"""Geocoding mundial vía Nominatim (OpenStreetMap), proxied desde el backend.

El proxy agrega el User-Agent que exige la política de uso de Nominatim y
normaliza la respuesta para el frontend.
"""
import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

NOMINATIM = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "IgnisGuard/1.0 (NASA Space Apps Challenge)"}
TIMEOUT = 15


def _short_name(result: dict) -> str:
    """Nombre compacto: `name` o las dos primeras partes del display_name."""
    if result.get("name"):
        return result["name"]
    parts = (result.get("display_name") or "").split(", ")
    return ", ".join(parts[:2]) or "Ubicación"


@router.get("/geocode")
def geocode(q: str = Query(min_length=2), limit: int = Query(6, ge=1, le=10)):
    """Busca lugares por nombre en cualquier parte del mundo."""
    try:
        response = requests.get(
            f"{NOMINATIM}/search",
            params={
                "format": "jsonv2",
                "q": q,
                "limit": limit,
                "accept-language": "es",
                "addressdetails": 1,
            },
            headers=HEADERS,
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo conectar con Nominatim: {type(exc).__name__}",
        ) from exc

    if not response.ok:
        raise HTTPException(status_code=502,
                            detail=f"Nominatim HTTP {response.status_code}")

    results = []
    for item in response.json():
        address = item.get("address") or {}
        results.append({
            "name": _short_name(item),
            "display": item.get("display_name", ""),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "type": item.get("type") or item.get("addresstype") or "",
            "country": address.get("country", ""),
        })
    return results


@router.get("/reverse")
def reverse(lat: float, lon: float):
    """Nombre aproximado de una coordenada (para búsqueda por lat/lon)."""
    try:
        response = requests.get(
            f"{NOMINATIM}/reverse",
            params={
                "format": "jsonv2",
                "lat": lat,
                "lon": lon,
                "accept-language": "es",
                "zoom": 10,
            },
            headers=HEADERS,
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo conectar con Nominatim: {type(exc).__name__}",
        ) from exc

    if not response.ok:
        raise HTTPException(status_code=502,
                            detail=f"Nominatim HTTP {response.status_code}")

    item = response.json()
    if "error" in item:
        return {"name": None}
    address = item.get("address") or {}
    return {
        "name": _short_name(item),
        "display": item.get("display_name", ""),
        "country": address.get("country", ""),
    }
