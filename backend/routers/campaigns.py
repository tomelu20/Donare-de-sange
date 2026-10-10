from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime, timedelta, time

from database import get_db
from schemas.schemas import CampaignCreate, CampaignOut, SlotOut
from models import Campaign, User
from routers.auth import send_email_via_gmail  # <--- Importul funcției de trimitere mail

router = APIRouter(
    prefix="/campaigns",
    tags=["Campaigns"]
)

@router.get("/", response_model=List[CampaignOut])
def get_campaigns(db: Session = Depends(get_db)):
    # Returnează toate campaniile (active și finalizate) ordonate după dată
    campaigns = db.query(Campaign).order_by(Campaign.date.desc()).all()
    return campaigns

@router.put("/{id}/toggle-status", status_code=status.HTTP_200_OK)
def toggle_campaign_status(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campania nu a fost găsită.")
    
    campaign.is_active = not campaign.is_active
    db.commit()
    
    status_str = "activată" if campaign.is_active else "finalizată"
    return {"message": f"Campania a fost {status_str} cu succes.", "is_active": campaign.is_active}

@router.post("/", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(campaign_data: CampaignCreate, db: Session = Depends(get_db)):
    # Creează o campanie nouă
    new_campaign = Campaign(
        title=campaign_data.title,
        location_name=campaign_data.location_name,
        address=campaign_data.address,
        date=campaign_data.date,
        end_date=campaign_data.end_date,
        start_time=campaign_data.start_time,
        end_time=campaign_data.end_time,
        slot_duration=campaign_data.slot_duration,
        capacity_per_slot=campaign_data.capacity_per_slot
    )
    
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    
    # --- TRIMITERE EMAIL AUTOMAT CĂTRE ABONAȚI ---
    try:
        subscribed_users = db.query(User).filter(User.notify_campaigns == True).all()
        
        subject = f"Campanie nouă de donare: {new_campaign.title}"
        
        for user in subscribed_users:
            if user.email:
                html_content = f"""
                <html>
                    <body>
                        <h3>Salutare, {user.name}!</h3>
                        <p>S-au deschis înscrierile pentru o nouă campanie de donare de sânge: <b>{new_campaign.title}</b>.</p>
                        <p><b>Locație:</b> {new_campaign.location_name} ({new_campaign.address})</p>
                        <p><b>Dată:</b> {new_campaign.date}</p>
                        <p>Te așteptăm să te programezi în aplicație!</p>
                        <hr>
                        <p style="font-size: 11px; color: #666;">Primești acest email deoarece ai bifat opțiunea de informare privind campaniile noi și restricțiile de călătorie.</p>
                    </body>
                </html>
                """
                send_email_via_gmail(
                    to_email=user.email,
                    code="", 
                    subject_title=subject,
                    html_message_content=html_content
                )
    except Exception as e:
        print(f"[Eroare Notificări Campanii]: {e}")
    # ---------------------------------------------
    
    return new_campaign

@router.get("/{id}", response_model=CampaignOut)
def get_campaign_by_id(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campania cu id-ul {id} nu a fost găsită."
        )
    return campaign

@router.get("/{id}/slots", response_model=List[SlotOut])
def get_campaign_slots(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.is_active == True).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campania nu a fost găsită sau este inactivă.")

    query_sql = text("""
        SELECT appointment_date, slot_time, COUNT(id) AS booked_count
        FROM appointments 
        WHERE campaign_id = :camp_id AND status != 'cancelled'
        GROUP BY appointment_date, slot_time
    """)
    
    try:
        rezultat = db.execute(query_sql, {"camp_id": id}).fetchall()
        taken_slots = {(row.appointment_date, row.slot_time): row.booked_count for row in rezultat}
    except Exception:
        rezultat = db.execute(text("""
            SELECT slot_time, COUNT(id) AS booked_count 
            FROM appointments WHERE campaign_id = :camp_id AND status != 'cancelled' GROUP BY slot_time
        """), {"camp_id": id}).fetchall()
        taken_slots = {(campaign.date, row.slot_time): row.booked_count for row in rezultat}

    slots = []
    start_date = campaign.date
    end_date = getattr(campaign, 'end_date', campaign.date) 

    current_date = start_date
    while current_date <= end_date:
        current_datetime = datetime.combine(current_date, campaign.start_time)
        end_datetime = datetime.combine(current_date, campaign.end_time)

        while current_datetime < end_datetime:
            current_time_obj = current_datetime.time()
            
            booked_count = taken_slots.get((current_date, current_time_obj), 0)
            remaining_capacity = campaign.capacity_per_slot - booked_count
            
            slots.append({
                "date": current_date.isoformat(),
                "time": current_time_obj.strftime("%H:%M:%S"),
                "available_slots": max(0, remaining_capacity),
                "is_available": remaining_capacity > 0
            })
            
            current_datetime += timedelta(minutes=campaign.slot_duration)
        
        current_date += timedelta(days=1)

    return slots