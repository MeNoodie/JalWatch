from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine, Base
from app.models.complaint import Complaint
from app.models.cluster import Cluster
from app.routes.complaints import router as complaints_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Citizen-powered water complaint intelligence platform for Delhi",
    version="0.1.0",
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
    }
