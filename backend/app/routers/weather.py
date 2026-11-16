import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.meteomatics import MeteomaticsError, point_weather

router = APIRouter()

# Curva estacional orientativa para el centro-norte de Argentina.
# El pico de incendios ocurre entre agosto y enero.
SEASON_BY_MONTH = [
    0.55, 0.35, 0.20, 0.12, 0.08, 0.06,
    0.10, 0.30, 0.55, 0.75, 0.70, 0.60,
]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _risk_level(probability: float) -> str:
    if probability < 30:
        return "Bajo"
    if probability < 55:
        return "Moderado"
    if probability < 85:
        return "Alto"
    return "Extremo"


def _condition(level: str) -> str:
    return {
        "Bajo": "bajo riesgo",
        "Moderado": "riesgo moderado",
        "Alto": "alto riesgo",
        "Extremo": "riesgo extremo",
    }[level]


def _season_label(score: float) -> str:
    if score >= 0.7:
        return "Temporada crítica"
    if score >= 0.5:
        return "Temporada alta"
    if score >= 0.3:
        return "Temporada media"
    return "Temporada baja"


def _region(db: Session, region_id: int) -> dict:
    row = db.execute(
        text("SELECT id, name, lat, lon FROM region WHERE id = :id"),
        {"id": region_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Región no encontrada")
    return dict(row)


def _place(db: Session, region: int | None,
           lat: float | None, lon: float | None) -> dict:
    """Resuelve el punto de consulta: región cargada o lat/lon arbitrario."""
    if region is not None and (lat is None and lon is None):
        return _region(db, region)
    if region is None and lat is not None and lon is not None:
        return {"id": None, "name": f"{lat:.3f}, {lon:.3f}",
                "lat": lat, "lon": lon}
    raise HTTPException(
        status_code=400,
        detail="pasar `region` o el par `lat`/`lon` (no ambos)",
    )


def _season_index(month: int, lat: float) -> float:
    """Índice estacional: la curva es austral; en el norte se desplaza 6 meses."""
    shift = 6 if lat > 23.5 else 0
    return SEASON_BY_MONTH[(month - 1 + shift) % 12]


def _weather_or_502(lat: float, lon: float, day: dt.date) -> dict:
    try:
        return point_weather(lat, lon, day)
    except MeteomaticsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/weather")
def weather(
    region: int | None = None,
    lat: float | None = None,
    lon: float | None = None,
    date: dt.date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
):
    """Clima real de Meteomatics para una región o un punto y una fecha."""
    place = _place(db, region, lat, lon)
    day = date or dt.date.today()
    data = _weather_or_502(place["lat"], place["lon"], day)
    return {
        "region": place["id"],
        "region_name": place["name"],
        "date": day.isoformat(),
        **data,
    }


@router.get("/forecast")
def forecast(
    region: int | None = None,
    lat: float | None = None,
    lon: float | None = None,
    date: dt.date = Query(alias="date"),
    db: Session = Depends(get_db),
):
    """Riesgo estimado a partir del clima de Meteomatics.

    Es un modelo heurístico transparente (v0), no un XGBoost entrenado.
    Sirve como reemplazo real de los datos meteorológicos del mock mientras
    se incorpora el modelo predictivo definitivo.
    """
    place = _place(db, region, lat, lon)
    weather_data = _weather_or_502(place["lat"], place["lon"], date)

    temperature = weather_data["temperature_c"]
    humidity = weather_data["humidity_pct"]
    wind = weather_data["wind_kmh"]
    rain = weather_data["precipitation_mm"]
    season = _season_index(date.month, place["lat"])

    dryness = _clamp((100.0 - humidity) / 80.0, 0.0, 1.0)
    heat = _clamp((temperature - 10.0) / 30.0, 0.0, 1.0)
    wind_factor = _clamp(wind / 60.0, 0.0, 1.0)

    # La lluvia de la hora analizada reduce el riesgo; no lo anula.
    rain_factor = _clamp(1.0 - rain / 20.0, 0.55, 1.0)
    raw_probability = (
        4.0
        + 30.0 * dryness
        + 20.0 * heat
        + 18.0 * wind_factor
        + 28.0 * season
    )
    probability = round(
        _clamp(raw_probability * rain_factor, 3.0, 97.0),
        1,
    )
    level = _risk_level(probability)
    season_label = _season_label(season)

    return {
        "region": place["id"],
        "region_name": place["name"],
        "date": date.isoformat(),
        "probability": probability,
        "level": level,
        "conditionLabel": _condition(level),
        "confidence": 72,
        "seasonLabel": season_label,
        "drivers": [
            {"label": "Temperatura", "value": f"{temperature:.1f} °C"},
            {"label": "Humedad relativa", "value": f"{humidity:.0f} %"},
            {"label": "Viento sostenido", "value": f"{wind:.0f} km/h"},
            {
                "label": "Índice estacional",
                "value": f"{round(season * 100)} %",
            },
        ],
        "weather": weather_data,
        "source": "Meteomatics",
        "model": "heuristic-v0",
    }
