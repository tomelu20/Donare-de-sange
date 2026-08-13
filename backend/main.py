import os
from dotenv import load_dotenv

# Această linie trebuie să fie prima, înainte de a importa routerele!
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from routers import auth, campaigns, appointments, eligibility, waitlist, ai, reminders

# Importăm funcția de verificare a expirării ofertelor din waitlist
from routers.appointments import check_expired_waitlist_offers

# Inițializare scheduler pentru task-uri în fundal
scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Porniți verificarea periodică la fiecare 1 minut
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

# Configurare CORS folosind lista din setări
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Includem routerele aplicației
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