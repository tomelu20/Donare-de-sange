from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from schemas.schemas import WaitlistCreate, WaitlistOut

router = APIRouter(
    prefix="/waitlist",
    tags=["Waitlist"]
)

@router.post("/", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def add_to_waitlist(waitlist_data: WaitlistCreate, db: Session = Depends(get_db)):
    
    # ------------------------------------------------------------------------
    # VALIDARE ABSOLUTĂ: Verificăm dacă are deja o programare activă în campanie
    # ------------------------------------------------------------------------
    appointment_check_query = text("""
        SELECT COUNT(id) AS existing_appointments 
        FROM appointments 
        WHERE user_id = :user_id 
          AND campaign_id = :campaign_id 
          AND status IN ('confirmed', 'attended')
    """)
    appointment_check = db.execute(appointment_check_query, {
        "user_id": waitlist_data.user_id,
        "campaign_id": waitlist_data.campaign_id
    }).fetchone()

    if appointment_check.existing_appointments > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ai deja o programare activă confirmată în această campanie! Nu te poți înscrie în lista de așteptare."
        )

    # Verificăm și dacă este deja înscris în waitlist pentru aceeași campanie (opțional, pentru siguranță completă)
    waitlist_check_query = text("""
        SELECT COUNT(id) AS existing_waitlist 
        FROM waitlist 
        WHERE user_id = :user_id 
          AND campaign_id = :campaign_id 
          AND status = 'waiting'
    """)
    waitlist_check = db.execute(waitlist_check_query, {
        "user_id": waitlist_data.user_id,
        "campaign_id": waitlist_data.campaign_id
    }).fetchone()

    if waitlist_check.existing_waitlist > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ești deja înscris în lista de așteptare pentru această campanie."
        )
    # ------------------------------------------------------------------------

    # Inserare SQL nativă în tabela 'waitlist' conform structurii din tables.sql
    insert_query = text("""
        INSERT INTO waitlist (campaign_id, user_id, name, surname, phone, email, preferred_time_range, travel_time_minutes, status)
        OUTPUT INSERTED.id, INSERTED.campaign_id, INSERTED.user_id, INSERTED.name, INSERTED.surname, INSERTED.phone, INSERTED.email, INSERTED.preferred_time_range, INSERTED.travel_time_minutes, INSERTED.status
        VALUES (:campaign_id, :user_id, :name, :surname, :phone, :email, :preferred_time_range, :travel_time_minutes, 'waiting')
    """)
    
    try:
        result = db.execute(insert_query, {
            "campaign_id": waitlist_data.campaign_id,
            "user_id": waitlist_data.user_id,
            "name": waitlist_data.name,
            "surname": waitlist_data.surname,
            "phone": waitlist_data.phone,
            "email": waitlist_data.email,
            "preferred_time_range": waitlist_data.preferred_time_range,
            "travel_time_minutes": waitlist_data.travel_time_minutes
        })
        
        row = result.mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la salvarea în baza de date: {str(e)}"
        )

@router.get("/all", status_code=status.HTTP_200_OK)
def get_all_waitlist_for_admin(db: Session = Depends(get_db)):
    # MODIFICAT: Am adăugat w.campaign_id în SELECT-ul de mai jos
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


# RUTA NOUĂ: Procesează asignarea din modalul grafic
@router.post("/{id}/assign", status_code=status.HTTP_200_OK)
def assign_waitlist_to_appointment(id: int, slot_time: str, db: Session = Depends(get_db)):
    # 1. Preluăm înregistrarea din waitlist și data campaniei
    wait_query = text("""
        SELECT w.campaign_id, w.user_id, w.status, c.date AS campaign_date 
        FROM waitlist w
        JOIN campaigns c ON w.campaign_id = c.id
        WHERE w.id = :wait_id
    """)
    wait_entry = db.execute(wait_query, {"wait_id": id}).fetchone()
    
    if not wait_entry:
        raise HTTPException(status_code=404, detail="Înregistrarea din lista de așteptare nu există.")

    if wait_entry.status == 'accepted':
        raise HTTPException(status_code=400, detail="Ai confirmat deja această ofertă din lista de așteptare!")

    app_check = db.execute(text("""
        SELECT COUNT(id) AS cnt 
        FROM appointments 
        WHERE user_id = :u_id AND campaign_id = :c_id AND status = 'confirmed'
    """), {"u_id": wait_entry.user_id, "c_id": wait_entry.campaign_id}).fetchone()

    if app_check.cnt > 0:
        raise HTTPException(status_code=400, detail="Ai deja o programare confirmată activă la această campanie!")

    try:
        # 2. Inserăm programarea cu appointment_date setat pe data campaniei!
        insert_app_query = text("""
            INSERT INTO appointments (campaign_id, user_id, slot_time, appointment_date, status, created_at)
            VALUES (:camp_id, :user_id, :slot_time, :app_date, 'confirmed', GETDATE())
        """)
        db.execute(insert_app_query, {
            "camp_id": wait_entry.campaign_id,
            "user_id": wait_entry.user_id,
            "slot_time": slot_time,
            "app_date": wait_entry.campaign_date
        })

        # Marcăm statusul în waitlist ca fiind 'accepted'
        db.execute(text("UPDATE waitlist SET status = 'accepted' WHERE id = :wait_id"), {"wait_id": id})
        
        db.commit()
        return {"message": "Donatorul a fost asignat cu succes pe slotul ales!"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Eroare la procesarea asignării: {str(e)}")