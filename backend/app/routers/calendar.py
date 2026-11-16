from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.geo import geo_filter

router = APIRouter()


@router.get("/calendar")
def calendar(region: int | None = None, lat: float | None = None,
             lon: float | None = None,
             year_from: int = Query(2006, alias="from"),
             year_to: int = Query(2026, alias="to"),
             db: Session = Depends(get_db)):
    where, params = geo_filter(region, lat, lon)

    if region is not None:
        rows = db.execute(text("""
            SELECT EXTRACT(YEAR FROM fecha)::int y,
                   EXTRACT(MONTH FROM fecha)::int m,
                   SUM(n_cells) cells, SUM(frp_sum) frp
            FROM region_day
            WHERE region_id = :region
              AND EXTRACT(YEAR FROM fecha) BETWEEN :a AND :b
            GROUP BY y, m ORDER BY y, m
        """), {"region": region, "a": year_from, "b": year_to}).mappings().all()
    else:
        rows = db.execute(text(f"""
            SELECT EXTRACT(YEAR FROM fecha)::int y,
                   EXTRACT(MONTH FROM fecha)::int m,
                   COUNT(*) cells, SUM(frp_sum) frp
            FROM fire_cell_day
            WHERE {where}
              AND EXTRACT(YEAR FROM fecha) BETWEEN :a AND :b
            GROUP BY y, m ORDER BY y, m
        """), {**params, "a": year_from, "b": year_to}).mappings().all()
    return [dict(r) for r in rows]
