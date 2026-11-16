from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import get_db

router = APIRouter()

@router.get("/calendar")
def calendar(region: int, year_from: int = Query(2006, alias="from"),
             year_to: int = Query(2026, alias="to"), db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT EXTRACT(YEAR FROM fecha)::int y, EXTRACT(MONTH FROM fecha)::int m,
               SUM(n_cells) cells, SUM(frp_sum) frp
        FROM region_day
        WHERE region_id = :r
          AND EXTRACT(YEAR FROM fecha) BETWEEN :a AND :b
        GROUP BY y, m ORDER BY y, m
    """), {"r": region, "a": year_from, "b": year_to}).mappings().all()
    return [dict(r) for r in rows]
