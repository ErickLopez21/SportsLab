from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nflreadpy.config import update_config

from app.core.settings import settings
from app.api.routes import health, nba, mlb
from app.api.routes.nfl import router as nfl_root_router


app = FastAPI(
    title="Sports Props API",
    description="NFL, NBA, MLB Player Props Analysis",
    version="1.0.0"
)


@app.on_event("startup")
def _configure_nflreadpy():
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    update_config(
        cache_mode=settings.cache_mode,
        cache_dir=settings.cache_dir,
        cache_duration=settings.cache_duration,
        timeout=settings.timeout,
        verbose=settings.verbose,
        user_agent=settings.user_agent,
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Sports Props API is running!"}


@app.get("/api/test")
def test_endpoint():
    return {
        "status": "success",
        "data": "Backend funcionando correctamente",
        "sports": ["NFL", "NBA", "MLB"],
    }


app.include_router(health.router, prefix="/api")
app.include_router(nfl_root_router, prefix="/api")
app.include_router(nba.router, prefix="/api")
app.include_router(mlb.router, prefix="/api")


