from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import connect_to_mongo, close_mongo_connection
from .config import get_settings
from .routes import auth, predict, dashboard, records, audit, mentor
from .services import ml_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────
    await connect_to_mongo()
    ml_service.verify_model_working()   # Fix 6: sanity-check ML at startup
    print("[CLINICALGUARD] Backend is ready. 🧬")
    yield
    # ── Shutdown ──────────────────────────────────────────────────
    await close_mongo_connection()
    print("[CLINICALGUARD] Shutdown complete.")



app = FastAPI(
    title="ClinicalGuard API",
    description="AI-powered clinical trial data integrity detection",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    print(f"DEBUG: {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.4f}s")
    return response

# ── CORS ──────────────────────────────────────────────────────────
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(dashboard.router)
app.include_router(records.router)
app.include_router(audit.router)
app.include_router(mentor.router)


@app.get("/health")
async def health_check():
    return {
        "status":  "healthy",
        "service": "ClinicalGuard API v1.0",
        "ml_model": "Decision Tree (dt_model.pkl)",
    }
