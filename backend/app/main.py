from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine, Base
from app.models.complaint import Complaint
from app.models.cluster import Cluster
from app.routes.complaints import router as complaints_router
from app.api.login import router as login_router
from app.api.Administration import router as admin_router
from app.api.observability import router as observability_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    Starts the 72-hour janitor background loop on startup and
    cancels it gracefully on shutdown.
    """
    from app.services.janitor import start_janitor_loop
    from app.services.trace_logger import emit_trace

    emit_trace(
        agent="system",
        event="startup",
        data={"app": settings.APP_NAME, "env": settings.APP_ENV},
        level="SUCCESS",
    )

    janitor_task = asyncio.create_task(start_janitor_loop())
    print("[JalWatch] Startup complete. Janitor loop active.")

    yield  # Application is running

    janitor_task.cancel()
    try:
        await janitor_task
    except asyncio.CancelledError:
        pass

    emit_trace(
        agent="system",
        event="shutdown",
        data={"app": settings.APP_NAME},
        level="WARNING",
    )
    print("[JalWatch] Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Citizen-powered water complaint intelligence platform for Delhi",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(complaints_router)
app.include_router(login_router)
app.include_router(admin_router)
app.include_router(observability_router)


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint for local monitoring and cloud load balancers."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
    }


@app.get("/", tags=["System"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs_url": "/docs",
        "health_url": "/health",
        "traces_url": "/api/admin/traces",
    }
