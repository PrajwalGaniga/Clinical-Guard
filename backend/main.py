from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .database import connect_to_mongo, close_mongo_connection
from .config import get_settings
from .routes import auth, predict, dashboard, records, audit, mentor
from .services import ml_service
import time

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────
    await connect_to_mongo()
    ml_service.verify_model_working()
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


def _get_real_ip(request: Request) -> str:
    """
    Extract the real client IP address.

    Priority order:
      1. X-Forwarded-For header (set by Next.js proxy or reverse proxy).
         Take only the FIRST address — it is the original client IP.
         Subsequent entries may be added by intermediate proxies and can
         be spoofed unless the proxy strips untrusted headers.
      2. X-Real-IP header (alternative set by nginx / Next.js).
      3. request.client.host — the direct TCP peer (127.0.0.1 from Next.js
         in local dev; real IP in production if no proxy is in front).

    NOTE: In production behind a trusted reverse proxy (nginx/Caddy),
    configure 'forwarded_allow_ips' in uvicorn to prevent header spoofing.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # XFF can be a comma-separated list: "client, proxy1, proxy2"
        real_ip = xff.split(",")[0].strip()
        if real_ip:
            return real_ip

    x_real = request.headers.get("x-real-ip")
    if x_real:
        return x_real.strip()

    # Direct TCP peer (local dev without proxy)
    if request.client:
        return request.client.host

    return "unknown"


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """
    Structured per-request log with real client IP and latency.
    This replaces the previous 'print(DEBUG:...)' approach.
    """
    start = time.time()
    real_ip = _get_real_ip(request)
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000

    print(
        f"[REQUEST] {request.method} {request.url.path} "
        f"| status={response.status_code} "
        f"| ip={real_ip} "
        f"| {duration_ms:.1f}ms"
    )
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
    from .services.blockchain_service import is_stub_mode
    return {
        "status":          "healthy",
        "service":         "ClinicalGuard API v1.0",
        "ml_model":        "Decision Tree (dt_model.pkl)",
        "blockchain_mode": "STUB" if is_stub_mode() else "LIVE",
    }
