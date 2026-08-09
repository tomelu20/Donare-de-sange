from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from typing import Optional
from pydantic import BaseModel

from database import get_db
from schemas.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"]
)

@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(appointment_data: AppointmentCreate, db: Session = Depends(get_db)):
    current_user_id = appointment_data.user_id

    # ------------------------------------------------------------------------
    # VALIDARE: VERIFICARE DUPLICARE PROGRAMARE (SECURIZATĂ PENTRU CONTURI ȘI INVITAȚI)
    # ------------------------------------------------------------------------
    if appointment_data.is_for_someone_else:
        if not appointment_data.guest_phone:
            raise HTTPException(status_code=400, detail="Numărul de telefon al persoanei programate este obligatoriu.")
            
        # 1. Verificăm dacă există deja o altă programare de tip INVITE cu acest număr de telefon
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

        # 2. CAZUL NOU DIN IMAGINE: Verificăm dacă numărul aparține unui cont înregistrat (ex: Popescu Ion) 
        # și dacă acel cont are deja o programare personală activă în campanie.
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
        # Logica standard: Utilizatorul curent dorește să se programeze pe el însuși
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
                detail="Ai deja o programare activă în această campanie! Te poți programa în alte campanii, dar doar o singură dată per locație."
            )

        # 3. CAZUL INVERS: Verificăm dacă cineva nu l-a programat deja pe utilizatorul curent ca invitat (folosind telefonul lui din profil)
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

    # ------------------------------------------------------------------------
    # RESTUL LOGICII DE INSERARE RĂMÂNE NESCHIMBAT
    # ------------------------------------------------------------------------
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
        raise HTTPException(status_code=400, detail="Ne pare rău, acest interval orar s-a ocupat între timp!")

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
        "g_email": appointment_data.guest_email, # <--- ADĂUGAT
        "g_blood": appointment_data.guest_blood_group
    })
    
    row = result.mappings().first()
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
def cancel_appointment(id: int, db: Session = Depends(get_db)):
    # Modificăm statusul în 'cancelled' pentru a elibera locul
    cancel_query = text("""
        UPDATE appointments 
        SET status = 'cancelled' 
        WHERE id = :app_id
    """)
    
    result = db.execute(cancel_query, {"app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Programarea a fost anulată cu succes."}

@router.get("/me", response_model=List[AppointmentOut])
def get_my_appointments(user_id: int, db: Session = Depends(get_db)):
    # Adăugăm a.is_for_someone_else = 0 pentru a exclude invitații din istoricul personal
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
          AND a.is_for_someone_else = 0  -- <-- FILTRARE ADĂUGATĂ AICI
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
            a.notes, -- <-- CÂMP NOU SELECTAT
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
    query = text("""
        UPDATE appointments 
        SET notes = :notes 
        WHERE id = :app_id
    """)
    result = db.execute(query, {"notes": payload.notes, "app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Observația a fost salvată cu succes."}

@router.put("/{id}/attend", status_code=status.HTTP_200_OK)
def attend_appointment(id: int, db: Session = Depends(get_db)):
    # Modificăm statusul în 'attended' (Prezent)
    query = text("""
        UPDATE appointments 
        SET status = 'attended' 
        WHERE id = :app_id
    """)
    result = db.execute(query, {"app_id": id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Programarea nu a fost găsită.")
        
    return {"message": "Donatorul a fost marcat ca prezent."}


@router.put("/{id}/noshow", status_code=status.HTTP_200_OK)
def noshow_appointment(id: int, db: Session = Depends(get_db)):
    # Modificăm statusul în 'no_show' (Absent)
    query = text("""
        UPDATE appointments 
        SET status = 'no_show' 
        WHERE id = :app_id
    """)
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
                CASE 
                    WHEN a.is_for_someone_else = 1 THEN a.guest_name 
                    ELSE u.name 
                END AS donor_name,
                CASE 
                    WHEN a.is_for_someone_else = 1 THEN a.guest_surname 
                    ELSE u.surname 
                END AS donor_surname,
                CASE 
                    WHEN a.is_for_someone_else = 1 THEN COALESCE(a.guest_blood_group, 'Nu știu')
                    ELSE COALESCE(u.blood_group, 'Nu știu')
                END AS blood_group
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
        WHERE (
            (a.is_for_someone_else = 1 AND a.guest_phone = :phone)
            OR 
            (a.is_for_someone_else = 0 AND u.phone = :phone)
        )
        AND a.status NOT IN ('cancelled', 'no_show') -- <-- Excludem anulate și absente
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