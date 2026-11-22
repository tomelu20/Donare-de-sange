import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from database import get_db
from schemas.schemas import WaitlistCreate, WaitlistOut
from routers.auth import ensure_owner_or_admin, get_current_user, is_admin, require_admin
from models import User

router = APIRouter(
    prefix="/waitlist",
    tags=["Waitlist"]
)
logger = logging.getLogger(__name__)

@router.post("/", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def add_to_waitlist(
    waitlist_data: WaitlistCreate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    user_id = current_user.id
    
    # Verificăm doar programările personale active (excludem programările făcute pentru altcineva și cele anulate)
    appointment_check_query = text("""
        SELECT COUNT(id) AS existing_appointments 
        FROM appointments 
        WHERE user_id = :user_id 
          AND campaign_id = :campaign_id 
          AND is_for_someone_else = 0
          AND status IN ('confirmed', 'attended')
    """)
    appointment_check = db.execute(appointment_check_query, {
        "user_id": user_id,
        "campaign_id": waitlist_data.campaign_id
    }).fetchone()

    if appointment_check.existing_appointments > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ai deja o programare personală activă confirmată în această campanie! Nu te poți înscrie în lista de așteptare."
        )

    waitlist_check_query = text("""
        SELECT COUNT(id) AS existing_waitlist 
        FROM waitlist 
        WHERE user_id = :user_id 
          AND campaign_id = :campaign_id 
          AND status = 'waiting'
    """)
    waitlist_check = db.execute(waitlist_check_query, {
        "user_id": user_id,
        "campaign_id": waitlist_data.campaign_id
    }).fetchone()

    if waitlist_check.existing_waitlist > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ești deja înscris în lista de așteptare pentru această campanie."
        )

    insert_query = text("""
        INSERT INTO waitlist (campaign_id, user_id, name, surname, phone, email, preferred_time_range, travel_time_minutes, status)
        OUTPUT INSERTED.id, INSERTED.campaign_id, INSERTED.user_id, INSERTED.name, INSERTED.surname, INSERTED.phone, INSERTED.email, INSERTED.preferred_time_range, INSERTED.travel_time_minutes, INSERTED.status
        VALUES (:campaign_id, :user_id, :name, :surname, :phone, :email, :preferred_time_range, :travel_time_minutes, 'waiting')
    """)
    
    try:
        result = db.execute(insert_query, {
            "campaign_id": waitlist_data.campaign_id,
            "user_id": user_id,
            "name": getattr(current_user, 'name', ''),
            "surname": getattr(current_user, 'surname', ''),
            "phone": getattr(current_user, 'phone', ''),
            "email": getattr(current_user, 'email', ''),
            "preferred_time_range": waitlist_data.preferred_time_range,
            "travel_time_minutes": waitlist_data.travel_time_minutes
        })
        
        row = result.mappings().first()
        db.commit()
        return row
    except Exception:
        db.rollback()
        logger.exception("Could not save a waitlist entry.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nu s-a putut salva înscrierea în lista de așteptare."
        )

@router.get("/all", status_code=status.HTTP_200_OK)
def get_all_waitlist_for_admin(
    admin_user: User = Depends(require_admin), 
    db: Session = Depends(get_db)
):
    query = text("""
        SELECT 
            w.id,
            w.campaign_id,
            w.name,
            w.surname,
            w.phone,
            w.email,
            w.preferred_time_range,
            w.travel_time_minutes,
            w.status,
            c.title AS campaign_title,
            c.date AS campaign_date
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        ORDER BY c.date ASC
    """)
    result = db.execute(query).mappings().all()
    return result


@router.get("/{id}/check-offer", status_code=status.HTTP_200_OK)
def check_waitlist_offer(
    id: int,
    slot_time: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = text("""
        SELECT w.id, w.user_id, w.status, w.notified_at, w.offered_slot_time, w.campaign_id,
               c.date AS campaign_date, c.capacity_per_slot
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.id = :wait_id
    """)
    offer = db.execute(query, {"wait_id": id}).fetchone()

    if not offer:
        raise HTTPException(status_code=404, detail="Oferta nu mai există.")

    ensure_owner_or_admin(offer.user_id, current_user)

    if offer.status == 'accepted':
        return {"available": True, "already_accepted": True, "message": "Ai confirmat deja această programare."}

    if offer.status != 'notified' or not offer.notified_at or not offer.offered_slot_time:
        return {
            "available": False,
            "reason": "inactive",
            "message": "Nu există o ofertă activă pentru această înscriere."
        }

    if not is_admin(current_user) and str(offer.offered_slot_time)[:5] != str(slot_time)[:5]:
        return {
            "available": False,
            "reason": "invalid_slot",
            "message": "Oferta este valabilă pentru alt interval orar."
        }

    if offer.notified_at:
        now = datetime.now()
        days_left = (offer.campaign_date - now.date()).days
        allowed_hours = 12 if days_left <= 7 else 24
        expiration_time = offer.notified_at + timedelta(hours=allowed_hours)

        if now > expiration_time or offer.status in ('expired', 'declined'):
            return {
                "available": False, 
                "reason": "expired", 
                "message": "Din cauză că nu ai răspuns în timp util, am trimis programarea mai departe și locul s-a ocupat."
            }

    count_query = text("""
        SELECT COUNT(id) AS booked 
        FROM appointments 
        WHERE campaign_id = :camp_id 
          AND slot_time = :slot_time 
          AND status != 'cancelled'
    """)
    booked_result = db.execute(count_query, {
        "camp_id": offer.campaign_id,
        "slot_time": slot_time
    }).fetchone()

    if booked_result.booked >= offer.capacity_per_slot:
        return {
            "available": False, 
            "reason": "occupied", 
            "message": "Din cauză că nu ai răspuns în timp util, am trimis programarea mai departe și locul s-a ocupat."
        }

    return {"available": True, "already_accepted": False, "message": "Locul este disponibil."}


@router.post("/{id}/assign", status_code=status.HTTP_200_OK)
def assign_waitlist_to_appointment(
    id: int,
    slot_time: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wait_query = text("""
        SELECT w.campaign_id, w.user_id, w.status, w.notified_at, w.offered_slot_time, c.date AS campaign_date, c.capacity_per_slot
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.id = :wait_id
    """)
    wait_entry = db.execute(wait_query, {"wait_id": id}).fetchone()
    
    if not wait_entry:
        raise HTTPException(status_code=404, detail="Înregistrarea din lista de așteptare nu există.")

    ensure_owner_or_admin(wait_entry.user_id, current_user)

    if wait_entry.status == 'accepted':
        raise HTTPException(status_code=400, detail="Ai confirmat deja această ofertă din lista de așteptare!")

    if not is_admin(current_user) and (
        wait_entry.status != 'notified'
        or not wait_entry.notified_at
        or not wait_entry.offered_slot_time
    ):
        raise HTTPException(status_code=400, detail="Nu există o ofertă activă pentru această înscriere.")

    if is_admin(current_user) and wait_entry.status not in ('waiting', 'notified'):
        raise HTTPException(status_code=400, detail="Această înscriere nu mai poate fi asignată.")

    if (
        not is_admin(current_user)
        and str(wait_entry.offered_slot_time)[:5] != str(slot_time)[:5]
    ):
        raise HTTPException(status_code=400, detail="Oferta este valabilă pentru alt interval orar.")

    if wait_entry.notified_at:
        now = datetime.now()
        days_left = (wait_entry.campaign_date - now.date()).days
        allowed_hours = 12 if days_left <= 7 else 24
        expiration_time = wait_entry.notified_at + timedelta(hours=allowed_hours)

        if now > expiration_time or wait_entry.status == 'expired':
            db.execute(text("UPDATE waitlist SET status = 'expired' WHERE id = :wait_id"), {"wait_id": id})
            db.commit()
            raise HTTPException(
                status_code=400, 
                detail="Din cauză că nu ai răspuns în timp util, am trimis programarea mai departe și locul s-a ocupat."
            )

    count_query = text("""
        SELECT COUNT(id) AS booked 
        FROM appointments 
        WHERE campaign_id = :camp_id 
          AND slot_time = :slot_time 
          AND status != 'cancelled'
    """)
    booked_result = db.execute(count_query, {
        "camp_id": wait_entry.campaign_id,
        "slot_time": slot_time
    }).fetchone()

    if booked_result.booked >= wait_entry.capacity_per_slot:
        raise HTTPException(
            status_code=400, 
            detail="Din cauză că nu ai răspuns în timp util, am trimis programarea mai departe și locul s-a ocupat."
        )

    app_check = db.execute(text("""
        SELECT COUNT(id) AS cnt 
        FROM appointments 
        WHERE user_id = :u_id AND campaign_id = :c_id AND is_for_someone_else = 0 AND status IN ('confirmed', 'attended')
    """), {"u_id": wait_entry.user_id, "c_id": wait_entry.campaign_id}).fetchone()

    if app_check.cnt > 0:
        raise HTTPException(status_code=400, detail="Ai deja o programare personală confirmată activă la această campanie!")

    try:
        insert_app_query = text("""
            INSERT INTO appointments (campaign_id, user_id, slot_time, status, created_at, is_for_someone_else)
            VALUES (:camp_id, :user_id, :slot_time, 'confirmed', GETDATE(), 0)
        """)
        db.execute(insert_app_query, {
            "camp_id": wait_entry.campaign_id,
            "user_id": wait_entry.user_id,
            "slot_time": slot_time
        })

        db.execute(text("UPDATE waitlist SET status = 'accepted' WHERE id = :wait_id"), {"wait_id": id})
        
        db.commit()
        return {"message": "Programarea ta a fost confirmată cu succes!"}
        
    except Exception:
        db.rollback()
        logger.exception("Could not assign a waitlist offer.")
        raise HTTPException(status_code=500, detail="Nu s-a putut confirma programarea din lista de așteptare.")

@router.get("/me", status_code=status.HTTP_200_OK)
def get_my_waitlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = text("""
        SELECT
            w.id,
            w.campaign_id,
            w.name,
            w.surname,
            w.phone,
            w.email,
            w.preferred_time_range,
            w.travel_time_minutes,
            w.status,
            c.title AS campaign_title,
            c.date AS campaign_date
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.user_id = :user_id
        ORDER BY c.date ASC
    """)
    result = db.execute(query, {"user_id": current_user.id}).mappings().all()
    return result

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def leave_waitlist(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.execute(
        text("SELECT user_id, campaign_id, status, offered_slot_time FROM waitlist WHERE id = :wait_id"),
        {"wait_id": id}
    ).fetchone()
    if not entry:
        raise HTTPException(status_code=404, detail="Înregistrarea din lista de așteptare nu există.")

    ensure_owner_or_admin(entry.user_id, current_user)

    if entry.status in ("accepted", "expired", "declined"):
        raise HTTPException(status_code=400, detail="Această înscriere nu mai poate fi anulată.")

    db.execute(
        text("UPDATE waitlist SET status = 'declined' WHERE id = :wait_id"),
        {"wait_id": id}
    )
    db.commit()

    if entry.status == "notified" and entry.offered_slot_time:
        from routers.appointments import notify_next_in_waitlist
        notify_next_in_waitlist(entry.campaign_id, str(entry.offered_slot_time), None, db)

    return {"message": "Ai ieșit din lista de așteptare."}