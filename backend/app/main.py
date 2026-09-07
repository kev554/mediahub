from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers import media
from app.routers import groups
from app.routers import albums
from app.routers import users

from app.services.media_storage import initialize_storage


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


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTES
# =========================================================

app.include_router(auth_router)

app.include_router(media.router)

app.include_router(groups.router)

app.include_router(albums.router)

app.include_router(users.router)


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
def health():
    return {
        "status": "healthy",
        "service": "mediahub-api",
    }

