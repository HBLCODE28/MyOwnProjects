from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.config import get_settings
from app.services.watcher_service import watcher_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings().ensure_directories()
    watcher_manager.start()
    try:
        yield
    finally:
        watcher_manager.stop()

app = FastAPI(title="StreamLocal", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4310",
        "http://localhost:4310",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

@app.get("/")
def root():
    return {"name": "StreamLocal", "status": "backend-online", "health": "/api/v1/health"}
