from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import calendar, fires, regions

app = FastAPI(title="OrbiTag API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(regions.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(fires.router, prefix="/api")
