from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import get_db

router = APIRouter()

@router.get("/fires")
def fires(region: int, day: date, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT cell, lat, lon, n_modis, n_viirs, frp_max, agreement::int AS agreement
        FROM fire_cell_day
        WHERE region_id = :r AND fecha = :d
    """), {"r": region, "d": day}).mappings().all()
    return {"date": day, "count": len(rows), "points": [dict(r) for r in rows]}

@router.get("/on-this-day")
def on_this_day(region: int, month: int, day: int, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT EXTRACT(YEAR FROM fecha)::int y, COUNT(*) cells, SUM(frp_sum) frp
        FROM fire_cell_day
        WHERE region_id = :r
          AND EXTRACT(MONTH FROM fecha) = :m
          AND EXTRACT(DAY FROM fecha) = :d
        GROUP BY y ORDER BY y
    """), {"r": region, "m": month, "d": day}).mappings().all()
    return [dict(r) for r in rows]
