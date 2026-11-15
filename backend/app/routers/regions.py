from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import get_db

router = APIRouter()

@router.get("/regions")
def regions(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, name, lat, lon FROM region ORDER BY id")).mappings().all()
    return [dict(r) for r in rows]
