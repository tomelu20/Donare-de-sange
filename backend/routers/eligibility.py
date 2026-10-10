from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import urllib.parse
from datetime import datetime, timedelta

from database import get_db
from schemas.schemas import QuestionOut, AppointmentWithAnswersCreate, AppointmentOut
from routers.auth import get_current_user, require_admin
from models import User

router = APIRouter(
    prefix="/eligibility",
    tags=["Eligibility Questionnaire"]
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def format_date_ro(date_str: str) -> str:
    """Convertește data din YYYY-MM-DD în DD.MM.YYYY"""
    try:
        dt_obj = datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
        return dt_obj.strftime("%d.%m.%Y")
    except Exception:
        return str(date_str)

def send_appointment_confirmation_email(to_email: str, donor_name: str, campaign_title: str, location_name: str, address: str, appointment_date: str, slot_time: str):
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        return
        
    slot_time_formatted = str(slot_time)[:5]
    appointment_date_formatted = format_date_ro(appointment_date)
    
    clean_date = str(appointment_date).replace("-", "")
    clean_time = slot_time_formatted.replace(":", "") + "00"
    start_datetime = f"{clean_date}T{clean_time}"
      
    try:
        dt_obj = datetime.strptime(f"{appointment_date} {slot_time_formatted}", "%Y-%m-%d %H:%M")
        end_dt_obj = dt_obj + timedelta(minutes=30)
        end_clean_date = end_dt_obj.strftime("%Y%m%d")
        end_clean_time = end_dt_obj.strftime("%H%M%S")
        end_datetime_str = f"{end_clean_date}T{end_clean_time}"
    except Exception:
        end_datetime_str = start_datetime

    cal_text = urllib.parse.quote(f"Donare de Sânge - {campaign_title}")
    cal_details = urllib.parse.quote(f"Programare pentru donare de sânge în cadrul campaniei {campaign_title}.\nLocație: {location_name} ({address})")
    cal_location = urllib.parse.quote(f"{location_name}, {address}")
    
    google_cal_url = (
        f"https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={cal_text}"
        f"&dates={start_datetime}/{end_datetime_str}"
        f"&details={cal_details}"
        f"&location={cal_location}"
    )

    message = MIMEMultipart()
    message["From"] = f"Donare Sange <{email_user}>"
    message["To"] = to_email
    message["Subject"] = f"🩸 Programare Confirmată: {campaign_title}"
    
    corp_email = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f4f4f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #e63946; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 22px;">🎉 Programare Confirmată!</h2>
                </div>
                <div style="padding: 25px;">
                    <p style="font-size: 16px;">Salut, <strong>{donor_name}</strong>!</p>
                    <p style="font-size: 15px;">Programarea ta în cadrul campaniei <strong>{campaign_title}</strong> a fost înregistrată cu succes.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e63946;">
                        <p style="margin: 5px 0;">📅 <strong>Data:</strong> {appointment_date_formatted}</p>
                        <p style="margin: 5px 0;">⏰ <strong>Ora:</strong> {slot_time_formatted}</p>
                        <p style="margin: 5px 0;">📍 <strong>Locația:</strong> {location_name} ({address})</p>
                    </div>

                    <div style="margin: 30px 0; text-align: center;">
                        <a href="{google_cal_url}" target="_blank" style="background-color: #4285F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                            📅 Salvează în Google Calendar
                        </a>
                    </div>
                    
                    <p style="font-size: 13px; color: #666; text-align: center; margin-top: 20px;">
                        Te așteptăm cu drag! Îți mulțumim pentru gestul tău salvator.
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
    except Exception as e:
        print(f"[Appointment Email Error] {e}")

# Schema Pydantic locală pentru crearea unei întrebări noi
class QuestionCreatePayload(BaseModel):
    question_text: str
    type: str

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

@router.post("/submit", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def submit_appointment_with_answers(
    payload: AppointmentWithAnswersCreate, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    current_user_id = current_user.id
    
    campaign_query = text("SELECT title, location_name, address, capacity_per_slot, is_active FROM campaigns WHERE id = :camp_id")
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

    try:
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
        
        db.commit()
        
        recipient_email = payload.appointment.guest_email if payload.appointment.is_for_someone_else else current_user.email
        donor_fullname = f"{payload.appointment.guest_name} {payload.appointment.guest_surname}" if payload.appointment.is_for_someone_else else f"{current_user.name} {current_user.surname}"
        
        if recipient_email:
            background_tasks.add_task(
                send_appointment_confirmation_email,
                to_email=recipient_email,
                donor_name=donor_fullname,
                campaign_title=campaign.title,
                location_name=campaign.location_name,
                address=campaign.address,
                appointment_date=str(payload.appointment.appointment_date),
                slot_time=str(payload.appointment.slot_time)
            )
        
        return {
            "id": row["id"],
            "campaign_id": row["campaign_id"],
            "user_id": row["user_id"],
            "slot_time": row["slot_time"].strftime("%H:%M:%S") if hasattr(row["slot_time"], "strftime") else row["slot_time"],
            "status": row["status"],
            "created_at": row["created_at"]
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la salvarea programării și a chestionarului: {str(e)}"
        )

@router.post("/questions", status_code=status.HTTP_201_CREATED)
def create_question(
    payload: QuestionCreatePayload, 
    admin_user: User = Depends(require_admin), 
    db: Session = Depends(get_db)
):
    query = text("""
        INSERT INTO eligibility_questions (question_text, type, is_required, is_active)
        VALUES (:text, :type, 1, 1)
    """)
    db.execute(query, {"text": payload.question_text, "type": payload.type})
    db.commit()
    return {"message": "Întrebarea a fost adăugată cu succes!"}

@router.delete("/questions/{question_id}", status_code=status.HTTP_200_OK)
def delete_question(
    question_id: int, 
    admin_user: User = Depends(require_admin), 
    db: Session = Depends(get_db)
):
    try:
        delete_answers_query = text("DELETE FROM eligibility_answers WHERE question_id = :q_id")
        db.execute(delete_answers_query, {"q_id": question_id})
        
        delete_question_query = text("DELETE FROM eligibility_questions WHERE id = :q_id")
        result = db.execute(delete_question_query, {"q_id": question_id})
        
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Întrebarea nu a fost găsită.")
            
        return {"message": "Întrebarea și răspunsurile asociate au fost șterse cu succes!"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la ștergerea întrebării: {str(e)}"
        )