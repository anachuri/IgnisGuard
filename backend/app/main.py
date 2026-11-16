from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import calendar, fires, geocode, regions, refresh, weather

app = FastAPI(title="IgnisGuard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(regions.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(fires.router, prefix="/api")
app.include_router(refresh.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(geocode.router, prefix="/api")
