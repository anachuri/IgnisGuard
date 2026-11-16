"""Cliente mínimo para la API de Meteomatics.

La API devuelve un JSON con un bloque por parámetro. Para una coordenada y
un instante dados, extraemos temperatura, humedad, viento y precipitación.

Credenciales (variables de entorno, nunca en el código):
  METEOMATICS_USERNAME
  METEOMATICS_PASSWORD
"""
import datetime as dt
import os

import requests
from dotenv import load_dotenv

load_dotenv()

BASE = "https://api.meteomatics.com"
PARAMETERS = [
    "t_2m:C",
    "relative_humidity_2m:p",
    "wind_speed_10m:kmh",
    "precip_1h:mm",
]
FIELD_BY_PARAMETER = {
    "t_2m:C": "temperature_c",
    "relative_humidity_2m:p": "humidity_pct",
    "wind_speed_10m:kmh": "wind_kmh",
    "precip_1h:mm": "precipitation_mm",
}


class MeteomaticsError(RuntimeError):
    """Error de configuración o de respuesta de Meteomatics."""


def _credentials():
    username = os.getenv("METEOMATICS_USERNAME")
    password = os.getenv("METEOMATICS_PASSWORD")
    if not username or not password:
        raise MeteomaticsError(
            "Faltan METEOMATICS_USERNAME y METEOMATICS_PASSWORD en .env"
        )
    return username, password


def point_weather(lat: float, lon: float, day: dt.date,
                  hour: int = 12) -> dict:
    """Devuelve el clima puntual para una coordenada y un día.

    Usa 12:00 UTC por defecto, que cae dentro de la mañana argentina y evita
    los extremos diarios. Meteomatics sirve tanto histórico como pronóstico
    con el mismo endpoint.
    """
    username, password = _credentials()
    when = f"{day.isoformat()}T{hour:02d}:00:00Z"
    url = (
        f"{BASE}/{when}/{','.join(PARAMETERS)}/"
        f"{lat:.4f},{lon:.4f}/json"
    )

    try:
        response = requests.get(
            url,
            auth=(username, password),
            timeout=25,
        )
    except requests.RequestException as exc:
        raise MeteomaticsError(
            f"No se pudo conectar con Meteomatics: {type(exc).__name__}"
        ) from exc

    if response.status_code == 401:
        raise MeteomaticsError("Meteomatics rechazó las credenciales (401)")
    if response.status_code == 429:
        raise MeteomaticsError("Meteomatics limitó la cantidad de consultas (429)")
    if not response.ok:
        detail = response.text.strip()[:180]
        raise MeteomaticsError(
            f"Meteomatics respondió HTTP {response.status_code}: {detail}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise MeteomaticsError("Meteomatics devolvió una respuesta no JSON") from exc

    values = {}
    for block in payload.get("data", []):
        parameter = block.get("parameter")
        field = FIELD_BY_PARAMETER.get(parameter)
        if not field:
            continue
        coordinates = block.get("coordinates") or []
        dates = coordinates[0].get("dates") if coordinates else None
        if dates:
            values[field] = dates[0].get("value")

    missing = [field for field in FIELD_BY_PARAMETER.values()
               if values.get(field) is None]
    if missing:
        raise MeteomaticsError(
            "Meteomatics no devolvió: " + ", ".join(missing)
        )

    return {
        "time": when,
        "latitude": lat,
        "longitude": lon,
        "temperature_c": round(float(values["temperature_c"]), 1),
        "humidity_pct": round(float(values["humidity_pct"]), 1),
        "wind_kmh": round(float(values["wind_kmh"]), 1),
        "precipitation_mm": round(float(values["precipitation_mm"]), 1),
        "source": "Meteomatics",
    }
