"""Refresh bajo demanda: una región + rango de fechas acotado.

POST /api/refresh {region_id, start, end} -> 202 y corre el pipeline
FIRMS -> harmonize -> MySQL en un thread background.
GET /api/refresh/status -> estado para que el front haga polling.

Los backfills históricos amplios se hacen por terminal con
etl/refresh.py --from/--to (fuera del alcance de este endpoint).
"""
import datetime as dt
import os
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

BACKEND = Path(__file__).resolve().parents[2]
ETL = BACKEND / "etl"
sys.path.insert(0, str(ETL))

router = APIRouter()
_lock = threading.Lock()
_state = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "ok": None,
    "detail": "",
    "request": None,
}

MAX_RANGE_DAYS = 366


class RefreshRequest(BaseModel):
    region_id: int
    start: dt.date
    end: dt.date


def _iso_now():
    return dt.datetime.now().isoformat(timespec="seconds")


def _region_bbox(region_id: int) -> str:
    """Bounding box de una región, derivado de regiones.geojson."""
    import geopandas as gpd

    g = gpd.read_file(BACKEND / "data" / "regiones.geojson").to_crs(4326)
    grp = g[g["region_id"] == region_id]
    if grp.empty:
        raise HTTPException(status_code=404,
                            detail=f"region_id {region_id} sin geometría")
    minx, miny, maxx, maxy = grp.total_bounds
    pad = 0.05
    return (f"{minx - pad:.4f},{miny - pad:.4f},"
            f"{maxx + pad:.4f},{maxy + pad:.4f}")


def _run(bbox: str, start: dt.date, end: dt.date):
    try:
        import download_firms

        today = dt.date.today()
        sp_end = min(end, today - dt.timedelta(days=download_firms.SP_LAG_DAYS))
        nrt_start = (
            max(sp_end + dt.timedelta(days=1), start)
            if sp_end < end else None
        )

        old_cwd = os.getcwd()
        os.chdir(BACKEND)
        try:
            download_firms.download([bbox], start, end,
                                    nrt_start=nrt_start)
            subprocess.run([sys.executable, str(ETL / "harmonize.py")],
                           check=True)
            subprocess.run([sys.executable, str(ETL / "load_mysql.py")],
                           check=True)
        finally:
            os.chdir(old_cwd)

        _state.update(ok=True, detail=f"{start} -> {end} cargado")
    except Exception as exc:
        _state.update(ok=False, detail=f"{type(exc).__name__}: {exc}"[:400])
    finally:
        _state["running"] = False
        _state["finished_at"] = _iso_now()
        _lock.release()


@router.post("/refresh", status_code=202)
def refresh(req: RefreshRequest):
    today = dt.date.today()
    if req.start > req.end:
        raise HTTPException(status_code=400,
                            detail="start no puede ser posterior a end")
    if req.end > today:
        raise HTTPException(status_code=400,
                            detail="end no puede ser una fecha futura")
    if (req.end - req.start).days > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"rango máximo {MAX_RANGE_DAYS} días; "
                   "para históricos usar etl/refresh.py",
        )

    bbox = _region_bbox(req.region_id)  # 404 si la región no existe

    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="refresh ya en curso")

    _state.update(
        running=True,
        started_at=_iso_now(),
        finished_at=None,
        ok=None,
        detail="",
        request={
            "region_id": req.region_id,
            "start": req.start.isoformat(),
            "end": req.end.isoformat(),
        },
    )
    threading.Thread(
        target=_run,
        args=(bbox, req.start, req.end),
        daemon=True,
    ).start()
    return {"status": "started"}


@router.get("/refresh/status")
def status():
    return dict(_state)
