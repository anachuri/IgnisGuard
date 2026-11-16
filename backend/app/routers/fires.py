import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.geo import geo_filter

router = APIRouter()

# Límite de días exportables en una sola descarga CSV.
MAX_EXPORT_DAYS = 366


@router.get("/fires")
def fires(day: date, region: int | None = None,
          lat: float | None = None, lon: float | None = None,
          db: Session = Depends(get_db)):
    where, params = geo_filter(region, lat, lon)
    rows = db.execute(text(f"""
        SELECT cell, lat, lon, n_modis, n_viirs, frp_max, agreement
        FROM fire_cell_day
        WHERE {where} AND fecha = :d
    """), {**params, "d": day}).mappings().all()
    return {"date": day, "count": len(rows), "points": [dict(r) for r in rows]}


@router.get("/fires/daily")
def fires_daily(year: int, month: int, region: int | None = None,
                lat: float | None = None, lon: float | None = None,
                db: Session = Depends(get_db)):
    """Días del mes con detecciones (puente calendario mensual → día exacto)."""
    where, params = geo_filter(region, lat, lon)
    rows = db.execute(text(f"""
        SELECT fecha day, COUNT(*) cells,
               SUM(n_modis) n_modis, SUM(n_viirs) n_viirs, SUM(frp_sum) frp
        FROM fire_cell_day
        WHERE {where} AND YEAR(fecha) = :y AND MONTH(fecha) = :m
        GROUP BY fecha ORDER BY fecha
    """), {**params, "y": year, "m": month}).mappings().all()
    return [{"day": str(r["day"]), "cells": r["cells"],
             "n_modis": r["n_modis"], "n_viirs": r["n_viirs"],
             "frp": r["frp"]} for r in rows]


@router.get("/fires/export")
def fires_export(start: date, end: date, region: int | None = None,
                 lat: float | None = None, lon: float | None = None,
                 db: Session = Depends(get_db)):
    """Descarga CSV de los focos (celdas H3-día) en un rango de fechas.

    Acepta `region` o un punto `lat`/`lon`. Columnas: fecha, cell, lat, lon,
    n_modis, n_viirs, frp_max, frp_sum, agreement.
    """
    today = date.today()
    if start > end:
        raise HTTPException(status_code=400,
                            detail="start no puede ser posterior a end")
    if end > today:
        raise HTTPException(status_code=400,
                            detail="end no puede ser una fecha futura")
    if (end - start).days > MAX_EXPORT_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"rango máximo {MAX_EXPORT_DAYS} días por descarga",
        )

    where, params = geo_filter(region, lat, lon)

    def rows():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["fecha", "cell", "lat", "lon", "n_modis", "n_viirs",
                         "frp_max", "frp_sum", "agreement"])
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        result = db.execute(text(f"""
            SELECT fecha, cell, lat, lon, n_modis, n_viirs, frp_max, frp_sum,
                   agreement
            FROM fire_cell_day
            WHERE {where} AND fecha BETWEEN :a AND :b
            ORDER BY fecha, cell
        """), {**params, "a": start, "b": end})
        for row in result:
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    target = region if region is not None else f"{lat:.2f}_{lon:.2f}"
    filename = f"ignisguard_focos_{target}_{start}_{end}.csv"
    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/on-this-day")
def on_this_day(month: int, day: int, region: int | None = None,
                lat: float | None = None, lon: float | None = None,
                db: Session = Depends(get_db)):
    where, params = geo_filter(region, lat, lon)
    rows = db.execute(text(f"""
        SELECT YEAR(fecha) y, COUNT(*) cells, SUM(frp_sum) frp
        FROM fire_cell_day
        WHERE {where} AND MONTH(fecha) = :m AND DAY(fecha) = :d
        GROUP BY y ORDER BY y
    """), {**params, "m": month, "d": day}).mappings().all()
    return [dict(r) for r in rows]
