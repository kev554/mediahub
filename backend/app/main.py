import logging

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.database import engine
from app.routers.auth import router as auth_router
from app.routers import media
from app.routers import groups
from app.routers import albums
from app.routers import users
from app.routers.shares import router as share_router
from app.routers.trash import router as trash_router

from app.services.media_storage import initialize_storage
from app.services.media_storage import check_r2_connection


# =========================================================
# INITIALISATION DU STOCKAGE
# =========================================================

initialize_storage()


# =========================================================
# APPLICATION FASTAPI
# =========================================================

app = FastAPI(
    title="MediaHub API",
    description="API du serveur média personnel MediaHub",
    version="0.1.0",
)
logger = logging.getLogger(__name__)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
        "If-Range",
        "Range",
    ],
    expose_headers=[
        "Accept-Ranges",
        "Content-Disposition",
        "Content-Range",
    ],
)


# =========================================================
# ROUTES
# =========================================================

app.include_router(auth_router)

app.include_router(media.router)

app.include_router(groups.router)

app.include_router(albums.router)

app.include_router(users.router)

app.include_router(share_router)

app.include_router(trash_router)


# =========================================================
# ROUTE RACINE
# =========================================================

@app.get("/")
def root():
    return {
        "name": "MediaHub API",
        "version": "0.1.0",
        "status": "online",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health(response: Response):
    checks = {
        "database": "ok",
        "storage": "ok",
    }

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        checks["database"] = "unavailable"
        logger.exception("Database health check failed.")

    try:
        check_r2_connection()
    except Exception:
        checks["storage"] = "unavailable"
        logger.exception("Object storage health check failed.")

    healthy = all(value == "ok" for value in checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if healthy else "unhealthy",
        "service": "mediahub-api",
        "checks": checks,
    }
