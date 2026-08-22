import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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
    lifespan=lifespan
)

# Connect SlowAPI rate limiter
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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