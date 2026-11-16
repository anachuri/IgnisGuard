import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import calendar, fires, regions, refresh

app = FastAPI(title="IgnisGuard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(regions.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(fires.router, prefix="/api")
app.include_router(refresh.router, prefix="/api")
