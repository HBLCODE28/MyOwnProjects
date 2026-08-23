from fastapi import APIRouter
from app.api.v1 import health, library, media

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(library.router)
api_router.include_router(media.router)
