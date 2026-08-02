from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from pydantic import BaseModel

from database import get_db
from schemas.schemas import QuestionOut, AppointmentWithAnswersCreate, AppointmentOut

router = APIRouter(
    prefix="/eligibility",
    tags=["Eligibility Questionnaire"]
)

# 1. GET: Trimite întrebările către frontend active ordonate după ID
@router.get("/questions", response_model=List[QuestionOut])
def get_questions(db: Session = Depends(get_db)):
    query = text("""
        SELECT id, question_text, type, is_required, is_active 
        FROM eligibility_questions 
        WHERE is_active = 1
        ORDER BY id ASC
    """)
    result = db.execute(query).fetchall()
    return result


# 2. POST: Salvează programarea ȘI răspunsurile utilizatorului dinamic cu protecție Tranzacțională (Rollback)
@router.post("/submit", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def submit_appointment_with_answers(
    payload: AppointmentWithAnswersCreate, 
    db: Session = Depends(get_db)
):
    current_user_id = payload.appointment.user_id
    
    # --- ETAPA A: Verificăm capacitatea slotului ---
    campaign_query = text("SELECT capacity_per_slot, is_active FROM campaigns WHERE id = :camp_id")
    campaign = db.execute(campaign_query, {"camp_id": payload.appointment.campaign_id}).fetchone()
    
    if not campaign or not campaign.is_active:
        raise HTTPException(status_code=400, detail="Campania nu este disponibilă.")

    count_query = text("""
        SELECT COUNT(id) AS booked FROM appointments 
        WHERE campaign_id = :camp_id 
          AND slot_time = :slot_time 
          AND appointment_date = :app_date
          AND status != 'cancelled'
    """)
    booked_result = db.execute(count_query, {
        "camp_id": payload.appointment.campaign_id,
        "slot_time": payload.appointment.slot_time,
        "app_date": payload.appointment.appointment_date
    }).fetchone()
    
    if booked_result.booked >= campaign.capacity_per_slot:
        raise HTTPException(status_code=400, detail="Ne pare rău, acest interval orar s-a ocupat între timp!")

    # --- ETAPA B & C: Inserare tranzacțională (cu Rollback) ---
    try:
        # Inserăm programarea cu detaliile extinse
        insert_app_query = text("""
            INSERT INTO appointments (
                campaign_id, user_id, slot_time, appointment_date, status, created_at,
                is_for_someone_else, guest_name, guest_surname, guest_phone, guest_blood_group
            )
            OUTPUT INSERTED.id, INSERTED.campaign_id, INSERTED.user_id, INSERTED.slot_time, INSERTED.status, INSERTED.created_at
            VALUES (
                :camp_id, :user_id, :slot_time, :app_date, 'confirmed', GETDATE(),
                :is_someone_else, :g_name, :g_surname, :g_phone, :g_blood
            )
        """)
        
        app_result = db.execute(insert_app_query, {
            "camp_id": payload.appointment.campaign_id,
            "user_id": current_user_id,
            "slot_time": payload.appointment.slot_time,
            "app_date": payload.appointment.appointment_date,
            "is_someone_else": 1 if payload.appointment.is_for_someone_else else 0,
            "g_name": payload.appointment.guest_name,
            "g_surname": payload.appointment.guest_surname,
            "g_phone": payload.appointment.guest_phone,
            "g_blood": payload.appointment.guest_blood_group
        })
        
        row = app_result.mappings().first()
        appointment_id = row["id"]

        # Inserăm răspunsurile dinamice în eligibility_answers
        insert_answer_query = text("""
            INSERT INTO eligibility_answers (appointment_id, question_id, answer_text)
            VALUES (:app_id, :quest_id, :ans_text)
        """)
        
        for answer in payload.answers:
            db.execute(insert_answer_query, {
                "app_id": appointment_id,
                "quest_id": answer.question_id,
                "ans_text": answer.answer_text
            })
        
        # Confirmăm tranzacția doar dacă ambele operațiuni au reușit
        db.commit()
        
        return {
            "id": row["id"],
            "campaign_id": row["campaign_id"],
            "user_id": row["user_id"],
            "slot_time": row["slot_time"].strftime("%H:%M:%S") if hasattr(row["slot_time"], "strftime") else row["slot_time"],
            "status": row["status"],
            "created_at": row["created_at"]
        }

    except Exception as e:
        # În caz de eroare la inserarea răspunsurilor sau a programării, anulăm totul!
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la salvarea programării și a chestionarului: {str(e)}"
        )


# Schema Pydantic locală pentru crearea unei întrebări noi
class QuestionCreatePayload(BaseModel):
    question_text: str
    type: str

@router.post("/questions", status_code=status.HTTP_201_CREATED)
def create_question(payload: QuestionCreatePayload, db: Session = Depends(get_db)):
    query = text("""
        INSERT INTO eligibility_questions (question_text, type, is_required, is_active)
        VALUES (:text, :type, 1, 1)
    """)
    db.execute(query, {"text": payload.question_text, "type": payload.type})
    db.commit()
    return {"message": "Întrebarea a fost adăugată cu succes!"}

@router.delete("/questions/{question_id}", status_code=status.HTTP_200_OK)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    query = text("""
        DELETE FROM eligibility_questions 
        WHERE id = :q_id
    """)
    result = db.execute(query, {"q_id": question_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Întrebarea nu a fost găsită.")
        
    return {"message": "Întrebarea a fost ștearsă cu succes!"}