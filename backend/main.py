from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from routers import auth, campaigns, appointments, eligibility, waitlist, ai, reminders
from routers.appointments import check_expired_waitlist_offers

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(check_expired_waitlist_offers, 'interval', minutes=1)
    scheduler.start()
    print("[APScheduler] Task-ul automat de verificare pentru expirarea ofertelor din waitlist a fost pornit.")
    
    yield
    
    scheduler.shutdown()
    print("[APScheduler] Task-ul automat din fundal a fost oprit.")

app = FastAPI(
    title="Donare Sange API",
    lifespan=lifespan,
    docs_url=None if settings.ENV == "production" else "/docs",
    redoc_url=None if settings.ENV == "production" else "/redoc",
    openapi_url=None if settings.ENV == "production" else "/openapi.json"
)

# Connect SlowAPI rate limiter
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    origin.strip().rstrip("/")
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]
allowed_origins = set(origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def protect_cookie_authenticated_requests(request: Request, call_next):
    unsafe_methods = {"POST", "PUT", "PATCH", "DELETE"}
    has_cookie_session = bool(request.cookies.get("access_token"))

    if (
        request.method in unsafe_methods
        and has_cookie_session
        and request.headers.get("Origin") not in allowed_origins
    ):
        return JSONResponse(
            status_code=403,
            content={"detail": "Originea cererii nu este permisă."}
        )

    return await call_next(request)

app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(appointments.router)
app.include_router(eligibility.router)
app.include_router(waitlist.router)
app.include_router(ai.router)
app.include_router(reminders.router)

@app.get("/")
def root():
    return {"message": "Sistemul de programari donare sange este activ!"}