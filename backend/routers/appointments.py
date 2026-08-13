from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timedelta

from database import get_db, SessionLocal
from schemas.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"]
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ------------------------------------------------------------------------
# UTILITAR EMAIL NOTIFICARE WAITLIST
# ------------------------------------------------------------------------
def send_waitlist_notification_email(to_email: str, donor_name: str, campaign_title: str, slot_time: str, waitlist_id: int, time_limit_hours: int):
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        print("[CRITICAL] Datele de logare pentru Gmail lipsesc din .env!")
        return
        
    slot_time_formatted = str(slot_time)[:5]
    app_link = f"{FRONTEND_URL}?waitlist_offer=true&wait_id={waitlist_id}&slot={slot_time_formatted}"

    message = MIMEMultipart()
    message["From"] = f"Donare Sange <{email_user}>"
    message["To"] = to_email
    message["Subject"] = f"🎉 Loc Eliberat la ora {slot_time_formatted}! - {campaign_title}"
    
    corp_email = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f4f4f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #e63946; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 22px;">🩸 Loc Eliberat!</h2>
                </div>
                <div style="padding: 25px;">
                    <p style="font-size: 16px;">Salut, <strong>{donor_name}</strong>!</p>
                    <p style="font-size: 15px;">S-a eliberat locul de la ora <strong style="color: #e63946; font-size: 18px;">{slot_time_formatted}</strong> pentru campania <strong>{campaign_title}</strong>.</p>
                    
                    <p style="font-size: 14px; color: #d90429; font-weight: bold;">
                        ⏰ Ai la dispoziție {time_limit_hours} ore pentru a accepta sau refuza această programare.
                    </p>

                    <div style="margin: 30px 0; text-align: center;">
                        <a href="{app_link}" style="background-color: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">
                            👉 Intră în Aplicație pentru Confirmare
                        </a>
                    </div>
                    
                    <p style="font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                        Dacă nu răspunzi în {time_limit_hours} ore sau refuzi oferta, locul va fi redirecționat automat către următoarea persoană din lista de așteptare.
                    </p>
                </div>
            </div>
        </body>
    </html>
    """
    message.attach(MIMEText(corp_email, "html"))
    
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(email_user, email_password)
        server.sendmail(email_user, to_email, message.as_string())
        server.quit()
        print(f"[Waitlist Email Success] Notificare trimisă către {to_email}")
    except Exception as e:
        print(f"[Waitlist Email Error] Eroare la trimiterea mail-ului: {e}")

def notify_next_in_waitlist(campaign_id: int, slot_time: str, background_tasks: Optional[BackgroundTasks], db: Session):
    # Căutăm data campaniei
    camp_query = text("SELECT date FROM campaigns WHERE id = :camp_id")
    camp = db.execute(camp_query, {"camp_id": campaign_id}).fetchone()
    if not camp:
        return

    # Determinăm timpul de răspuns: 12 ore dacă mai e <= 7 zile până la donare, altfel 24 ore
    days_left = (camp.date - datetime.now().date()).days
    time_limit_hours = 12 if days_left <= 7 else 24

    # Căutăm URMĂTORUL donator cu status 'waiting'
    waitlist_query = text("""
        SELECT TOP 1 w.id, w.email, w.name, w.surname, c.title AS campaign_title
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.campaign_id = :camp_id AND w.status = 'waiting'
        ORDER BY w.id ASC
    """)
    next_in_waitlist = db.execute(waitlist_query, {"camp_id": campaign_id}).fetchone()

    if next_in_waitlist:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.execute(text("""
            UPDATE waitlist 
            SET status = 'notified', 
                notified_at = :now, 
                offered_slot_time = :slot_time 
            WHERE id = :wait_id
        """), {
            "now": now_str,
            "slot_time": str(slot_time),
            "wait_id": next_in_waitlist.id
        })
        db.commit()

        if background_tasks:
            background_tasks.add_task(
                send_waitlist_notification_email,
                to_email=next_in_waitlist.email,
                donor_name=f"{next_in_waitlist.name} {next_in_waitlist.surname}",
                campaign_title=next_in_waitlist.campaign_title,
                slot_time=str(slot_time),
                waitlist_id=next_in_waitlist.id,
                time_limit_hours=time_limit_hours
            )
        else:
            send_waitlist_notification_email(
                to_email=next_in_waitlist.email,
                donor_name=f"{next_in_waitlist.name} {next_in_waitlist.surname}",
                campaign_title=next_in_waitlist.campaign_title,
                slot_time=str(slot_time),
                waitlist_id=next_in_waitlist.id,
                time_limit_hours=time_limit_hours
            )

# ------------------------------------------------------------------------
# TASK DE SCHEDULER: VERIFICAREA SI EXPIRAREA OFERTELOR WAITLIST
# ------------------------------------------------------------------------
def check_expired_waitlist_offers():
    db = SessionLocal()
    try:
        query = text("""
            SELECT w.id, w.campaign_id, w.offered_slot_time, w.notified_at, c.date AS campaign_date
            FROM waitlist w
            JOIN campaigns c ON w.campaign_id = c.id
            WHERE w.status = 'notified'
        """)
        notified_entries = db.execute(query).fetchall()

        now = datetime.now()

        for entry in notified_entries:
            if not entry.notified_at:
                continue

            days_left = (entry.campaign_date - now.date()).days
            allowed_hours = 12 if days_left <= 7 else 24
            expiration_time = entry.notified_at + timedelta(hours=allowed_hours)

            if now > expiration_time:
                # Marcăm ca expirat
                db.execute(text("UPDATE waitlist SET status = 'expired' WHERE id = :w_id"), {"w_id": entry.id})
                db.commit()
                print(f"[Waitlist Scheduler] Oferta {entry.id} a expirat după {allowed_hours}h. Se notifică următorul.")
                
                # Trimitere către următoarea persoană
                notify_next_in_waitlist(entry.campaign_id, str(entry.offered_slot_time), None, db)

    except Exception as e:
        print(f"[Waitlist Scheduler Error] {e}")
    finally:
        db.close()


@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(appointment_data: AppointmentCreate, db: Session = Depends(get_db)):
    current_user_id = appointment_data.user_id

    if appointment_data.is_for_someone_else:
        if not appointment_data.guest_phone:
            raise HTTPException(status_code=400, detail="Numărul de telefon al persoanei programate este obligatoriu.")
            
        guest_check_query = text("""
            SELECT COUNT(id) AS existing_count 
            FROM appointments 
            WHERE campaign_id = :camp_id 
              AND guest_phone = :guest_phone 
              AND status IN ('confirmed', 'attended')
        """)
        guest_check = db.execute(guest_check_query, {
            "camp_id": appointment_data.campaign_id,
            "guest_phone": appointment_data.guest_phone
        }).fetchone()

        if guest_check.existing_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Persoana cu numărul de telefon {appointment_data.guest_phone} are deja o programare activă ca invitat în această campanie!"
            )

        account_holder_check_query = text("""
            SELECT COUNT(a.id) AS existing_count
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            WHERE a.campaign_id = :camp_id
              AND u.phone = :guest_phone
              AND a.is_for_someone_else = 0
              AND a.status IN ('confirmed', 'attended')
        """)
        account_holder_check = db.execute(account_holder_check_query, {
            "camp_id": appointment_data.campaign_id,
            "guest_phone": appointment_data.guest_phone
        }).fetchone()

        if account_holder_check.existing_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Această persoană deține un cont în aplicație și este deja programată personal la această campanie!"
            )
            
    else:
        user_check_query = text("""
            SELECT COUNT(id) AS existing_count 
            FROM appointments 
            WHERE user_id = :user_id 
              AND campaign_id = :camp_id 
              AND is_for_someone_else = 0
              AND status IN ('confirmed', 'attended')
        """)
        user_check = db.execute(user_check_query, {
            "user_id": current_user_id,
            "camp_id": appointment_data.campaign_id
        }).fetchone()
        
        if user_check.existing_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ai deja o programare activă în această campanie!"
            )

        user_profile_query = text("SELECT phone FROM users WHERE id = :user_id")
        user_profile = db.execute(user_profile_query, {"user_id": current_user_id}).fetchone()
        
        if user_profile:
            already_invited_check_query = text("""
                SELECT COUNT(id) AS existing_count
                FROM appointments
                WHERE campaign_id = :camp_id
                  AND guest_phone = :user_phone
                  AND is_for_someone_else = 1
                  AND status IN ('confirmed', 'attended')
            """)
            already_invited_check = db.execute(already_invited_check_query, {
                "camp_id": appointment_data.campaign_id,
                "user_phone": user_profile.phone
            }).fetchone()

            if already_invited_check.existing_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nu te poți programa deoarece un alt utilizator te-a înscris deja ca invitat în această campanie!"
                )

    campaign_query = text("SELECT capacity_per_slot, is_active FROM campaigns WHERE id = :camp_id")
    campaign = db.execute(campaign_query, {"camp_id": appointment_data.campaign_id}).fetchone()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campania nu există.")
    if not campaign.is_active:
        raise HTTPException(status_code=400, detail="Această campanie nu mai este activă.")

    count_query = text("""
        SELECT COUNT(id) AS booked 
        FROM appointments 
        WHERE campaign_id = :camp_id 
          AND slot_time = :slot_time 
          AND appointment_date = :app_date
          AND status != 'cancelled'
    """)
    booked_result = db.execute(count_query, {
        "camp_id": appointment_data.campaign_id,
        "slot_time": appointment_data.slot_time,
        "app_date": appointment_data.appointment_date
    }).fetchone()
    
    if booked_result.booked >= campaign.capacity_per_slot:
        raise HTTPException(
            status_code=400, 
            detail="Din cauză că nu ai răspuns în timp util, am trimis programarea mai departe și locul s-a ocupat."
        )

    insert_query = text("""
        INSERT INTO appointments (
            campaign_id, user_id, slot_time, appointment_date, status, created_at,
            is_for_someone_else, guest_name, guest_surname, guest_phone, guest_email, guest_blood_group
        )
        OUTPUT INSERTED.id, INSERTED.campaign_id, INSERTED.user_id, INSERTED.slot_time, INSERTED.status, INSERTED.created_at
        VALUES (
            :camp_id, :user_id, :slot_time, :app_date, 'confirmed', GETDATE(),
            :is_someone_else, :g_name, :g_surname, :g_phone, :g_email, :g_blood
        )
    """)
    
    result = db.execute(insert_query, {
        "camp_id": appointment_data.campaign_id,
        "user_id": current_user_id,
        "slot_time": appointment_data.slot_time,
        "app_date": appointment_data.appointment_date,
        "is_someone_else": 1 if appointment_data.is_for_someone_else else 0,
        "g_name": appointment_data.guest_name,
        "g_surname": appointment_data.guest_surname,
        "g_phone": appointment_data.guest_phone,
        "g_email": appointment_data.guest_email,
        "g_blood": appointment_data.guest_blood_group
    })
    
    row = result.mappings().first()

    db.execute(text("UPDATE waitlist SET status = 'accepted' WHERE user_id = :u_id AND campaign_id = :c_id"), {
        "u_id": current_user_id,
        "c_id": appointment_data.campaign_id
    })

    db.commit()
    
    return {
        "id": row["id"],
        "campaign_id": row["campaign_id"],
        "user_id": row["user_id"],
        "slot_time": row["slot_time"].strftime("%H:%M:%S") if hasattr(row["slot_time"], "strftime") else row["slot_time"],
        "status": row["status"],
        "created_at": row["created_at"]
    }


@router.put("/{id}/cancel", status_code=status.HTTP_200_OK)
def cancel_appointment(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    app_query = text("SELECT campaign_id, slot_time FROM appointments WHERE id = :app_id")
    app_row = db.execute(app_query, {"app_id": id}).fetchone()
    
    if not app_row:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")

    campaign_id = app_row.campaign_id
    slot_time = app_row.slot_time

    cancel_query = text("""
        UPDATE appointments 
        SET status = 'cancelled' 
        WHERE id = :app_id
    """)
    db.execute(cancel_query, {"app_id": id})

    notify_next_in_waitlist(campaign_id, str(slot_time), background_tasks, db)

    db.commit()
    return {"message": "Programarea a fost anulată cu succes."}


@router.post("/waitlist/decline", status_code=status.HTTP_200_OK)
def decline_waitlist_offer(wait_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    wait_query = text("SELECT campaign_id, offered_slot_time FROM waitlist WHERE id = :w_id")
    wait_entry = db.execute(wait_query, {"w_id": wait_id}).fetchone()

    if not wait_entry:
        raise HTTPException(status_code=404, detail="Înregistrarea din lista de așteptare nu există.")

    db.execute(text("UPDATE waitlist SET status = 'declined' WHERE id = :w_id"), {"w_id": wait_id})
    db.commit()

    slot_to_pass = str(wait_entry.offered_slot_time) if wait_entry.offered_slot_time else "09:00:00"
    notify_next_in_waitlist(wait_entry.campaign_id, slot_to_pass, background_tasks, db)

    return {"message": "Ai refuzat oferta. Locul a fost pasat către următorul donator din lista de așteptare."}

@router.get("/me", response_model=List[AppointmentOut])
def get_my_appointments(user_id: int, db: Session = Depends(get_db)):
    query = text("""
        SELECT 
            a.id, 
            a.campaign_id, 
            a.user_id, 
            a.slot_time, 
            a.status, 
            a.created_at,
            a.appointment_date,
            c.title AS campaign_title
        FROM appointments a
        JOIN campaigns c ON a.campaign_id = c.id
        WHERE a.user_id = :user_id 
          AND a.status != 'cancelled'
          AND a.is_for_someone_else = 0
        ORDER BY a.appointment_date DESC, a.slot_time DESC
    """)
    result = db.execute(query, {"user_id": user_id}).mappings().all()
    return result

@router.get("/all", status_code=status.HTTP_200_OK)
def get_all_appointments_for_admin(db: Session = Depends(get_db)):
    query = text("""
        SELECT 
            a.id AS appointment_id,
            a.slot_time,
            a.status,
            a.appointment_date AS campaign_date, 
            a.notes,
            CASE 
                WHEN a.is_for_someone_else = 1 THEN a.guest_name 
                ELSE u.name 
            END AS donor_name,
            CASE 
                WHEN a.is_for_someone_else = 1 THEN a.guest_surname 
                ELSE u.surname 
            END AS donor_surname,
            CASE 
                WHEN a.is_for_someone_else = 1 THEN a.guest_phone 
                ELSE u.phone 
            END AS donor_phone,
            c.title AS campaign_title
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        JOIN campaigns c ON a.campaign_id = c.id
        WHERE a.status != 'cancelled'
        ORDER BY a.appointment_date ASC, a.slot_time ASC
    """)
    result = db.execute(query).mappings().all()
    return result

class NoteUpdatePayload(BaseModel):
    notes: Optional[str] = None

@router.put("/{id}/notes", status_code=status.HTTP_200_OK)
def update_appointment_notes(id: int, payload: NoteUpdatePayload, db: Session = Depends(get_db)):
    query = text("UPDATE appointments SET notes = :notes WHERE id = :app_id")
    result = db.execute(query, {"notes": payload.notes, "app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Observația a fost salvată cu succes."}

@router.put("/{id}/attend", status_code=status.HTTP_200_OK)
def attend_appointment(id: int, db: Session = Depends(get_db)):
    query = text("UPDATE appointments SET status = 'attended' WHERE id = :app_id")
    result = db.execute(query, {"app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Donatorul a fost marcat ca prezent."}

@router.put("/{id}/noshow", status_code=status.HTTP_200_OK)
def noshow_appointment(id: int, db: Session = Depends(get_db)):
    query = text("UPDATE appointments SET status = 'no_show' WHERE id = :app_id")
    result = db.execute(query, {"app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Donatorul a fost marcat ca absent."}

@router.get("/top-donors", status_code=status.HTTP_200_OK)
def get_top_donors(db: Session = Depends(get_db)):
    query = text("""
        SELECT TOP 10 
            donor_name AS name,
            donor_surname AS surname,
            blood_group,
            COUNT(*) AS total_donations
        FROM (
            SELECT 
                CASE WHEN a.is_for_someone_else = 1 THEN a.guest_name ELSE u.name END AS donor_name,
                CASE WHEN a.is_for_someone_else = 1 THEN a.guest_surname ELSE u.surname END AS donor_surname,
                CASE WHEN a.is_for_someone_else = 1 THEN COALESCE(a.guest_blood_group, 'Nu știu') ELSE COALESCE(u.blood_group, 'Nu știu') END AS blood_group
            FROM appointments a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.status = 'attended'
        ) AS combined_donors
        GROUP BY donor_name, donor_surname, blood_group
        ORDER BY total_donations DESC
    """)
    result = db.execute(query).mappings().all()
    return result

@router.get("/donor-history", status_code=status.HTTP_200_OK)
def get_donor_history(phone: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT 
            a.id AS appointment_id,
            a.slot_time,
            a.status,
            a.appointment_date AS campaign_date, 
            a.notes,
            c.title AS campaign_title
        FROM appointments a
        JOIN campaigns c ON a.campaign_id = c.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE ((a.is_for_someone_else = 1 AND a.guest_phone = :phone) OR (a.is_for_someone_else = 0 AND u.phone = :phone))
          AND a.status NOT IN ('cancelled', 'no_show')
        ORDER BY a.appointment_date DESC, a.slot_time DESC
    """)
    rows = db.execute(query, {"phone": phone}).mappings().all()
    
    history = []
    for r in rows:
        history.append({
            "appointment_id": r["appointment_id"],
            "slot_time": str(r["slot_time"])[:5] if r["slot_time"] else "",
            "status": r["status"],
            "campaign_date": str(r["campaign_date"]) if r["campaign_date"] else "",
            "notes": r["notes"],
            "campaign_title": r["campaign_title"]
        })
        
    return history