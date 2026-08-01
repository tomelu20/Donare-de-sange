from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from google import genai
from google.genai import types
import os
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import List, Optional

from config import settings 
from database import get_db
from models import Campaign

router = APIRouter(
    prefix="/ai",
    tags=["AI Assistant"]
)

class MessageItem(BaseModel):
    sender: str  # 'user' sau 'ai'
    text: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageItem]] = []

gemini_key = settings.GEMINI_API_KEY if hasattr(settings, "GEMINI_API_KEY") else os.getenv("GEMINI_API_KEY", "")
gemini_key = gemini_key.strip() if gemini_key else ""

client = genai.Client(api_key=gemini_key) if gemini_key else None

@router.post("/chat", status_code=status.HTTP_200_OK)
def chat_with_assistant(payload: ChatRequest, db: Session = Depends(get_db)):
    if not client:
        return {
            "reply": "Asistentul AI este momentan dezactivat. Verificați variabila GEMINI_API_KEY din fișierul .env."
        }

    def get_active_campaigns() -> str:
        """
        Aduce toate campaniile de donare de sânge active din baza de date.
        Calculază și returnează DETALIAT locurile libere disponibile DEFALCATE PE FIECARE ORA / INTERVAL ORAR.
        Nu expune datele personale ale persoanelor înregistrate.
        """
        campaigns = db.query(Campaign).filter(Campaign.is_active == True).all()
        
        if not campaigns:
            return "În acest moment nu există campanii active de donare de sânge programate."

        result = "Campanii active disponibile și disponibilitate orară:\n"
        
        for c in campaigns:
            # 1. Preluăm toate programările active pentru această campanie grupate după dată și slot_time
            query_sql = text("""
                SELECT appointment_date, slot_time, COUNT(id) AS booked_count
                FROM appointments 
                WHERE campaign_id = :camp_id AND status != 'cancelled'
                GROUP BY appointment_date, slot_time
            """)
            
            try:
                rezultat = db.execute(query_sql, {"camp_id": c.id}).fetchall()
                taken_slots = {(row.appointment_date, row.slot_time): row.booked_count for row in rezultat}
            except Exception:
                rezultat = db.execute(text("""
                    SELECT slot_time, COUNT(id) AS booked_count 
                    FROM appointments WHERE campaign_id = :camp_id AND status != 'cancelled' GROUP BY slot_time
                """), {"camp_id": c.id}).fetchall()
                taken_slots = {(c.date, row.slot_time): row.booked_count for row in rezultat}

            # 2. Generăm sloturile pe zile și pe ore
            start_date = c.date
            end_date = c.end_date if c.end_date else c.date

            total_available_overall = 0
            slots_detail_text = ""

            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime("%d-%m-%Y")
                daily_slots_text = []
                
                current_datetime = datetime.combine(current_date, c.start_time)
                end_datetime = datetime.combine(current_date, c.end_time)

                while current_datetime < end_datetime:
                    time_obj = current_datetime.time()
                    time_str = time_obj.strftime("%H:%M")
                    
                    booked_count = taken_slots.get((current_date, time_obj), 0)
                    remaining = c.capacity_per_slot - booked_count

                    if remaining > 0:
                        total_available_overall += remaining
                        daily_slots_text.append(f"  - {remaining} loc(uri) la ora {time_str}")

                    current_datetime += timedelta(minutes=c.slot_duration)

                if daily_slots_text:
                    slots_detail_text += f"  Data {date_str}:\n" + "\n".join(daily_slots_text) + "\n"
                else:
                    slots_detail_text += f"  Data {date_str}: Toate locurile sunt ocupate!\n"

                current_date += timedelta(days=1)

            result += (
                f"- **{c.title}** (ID: {c.id})\n"
                f"  Locație: {c.location_name} ({c.address})\n"
                f"  📊 **Total locuri libere rămase:** {total_available_overall}\n"
                f"  🕒 **Defalcare locuri libere per interval orar:**\n"
                f"{slots_detail_text}\n"
            )
            
        return result

    try:
        available_tools = {
            "get_active_campaigns": get_active_campaigns
        }

        contents = []
        if payload.history:
            recent_history = payload.history[-6:]
            for msg in recent_history:
                role = "user" if msg.sender == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg.text)]
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=payload.message)]
            )
        )

        system_instruction = (
            "Ești asistentul virtual inteligent numit 'Don AI' integrat în Platforma Digitală de Donare Sânge.\n"
            "Misiunea ta este să ajuți donatorii cu informații calde, sigure, precise și optimiste despre proces.\n"
            "Ai acces la unealta `get_active_campaigns`. Folosește-o OBLIGATORIU de fiecare dată când utilizatorul "
            "întreabă despre campanii active, locații unde poate dona, dar ȘI atunci când întreabă CÂTE LOCURI LIBERE SAU PE CE ORE MAI SUNT DISPONIBILE.\n"
            "CÂND EȘTI ÎNTREBAT DESPRE LOCURI LIBERE: Răspunde clar afișând numărul total de locuri libere, URMAT DE LISTA DEFALCATĂ PE ORE (ex: '- 2 locuri la ora 09:00', '- 1 loc la ora 09:15').\n"
            "IMPORTANT: NU ai acces la datele personale ale persoanelor care au rezervat (nume, telefon etc.) din motive de confidențialitate GDPR.\n"
            "Reguli de bază privind donarea pe care trebuie să le cunoști și să le reamintești când ești întrebat:\n"
            "- Vârsta acceptată: între 18 și 60 de ani.\n"
            "- Greutate minimă: 50 kg atât pentru femei, cât și pentru bărbați.\n"
            "- Tensiunea arterială trebuie să fie stabilă.\n"
            "- Fără consum de alcool cu 48 de ore înainte de donare!\n"
            "- Micul dejun din dimineața donării trebuie să fie ușor (fără grăsimi, fără lactate grele), dar obligatoriu!\n"
            "- Hidratarea este esențială: recomandă-le să bea apă sau ceai înainte. Fără cafea chiar înainte de donare.\n"
            "Dacă utilizatorul întreabă probleme tehnice despre contul lui, erori sau dorește modificări administrative complexe, "
            "îndrumă-l politicos să folosească butoanele din Dashboard sau să contacteze echipa de suport / Administratorul.\n"
            "Răspunde exclusiv în limba română, folosește un ton empatic și profesionist. Păstrează răspunsurile concise și ușor de citit."
        )

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                max_output_tokens=3000,
                temperature=0.4,
                system_instruction=system_instruction,
                tools=[get_active_campaigns]
            )
        )

        if response.function_calls:
            function_responses = []
            
            for function_call in response.function_calls:
                name = function_call.name
                args = function_call.args
                
                if name in available_tools:
                    tool_result = available_tools[name](**args)
                    function_responses.append(
                        types.Part.from_function_response(
                            name=name,
                            response={'result': tool_result}
                        )
                    )
            
            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="user", parts=function_responses))

            final_response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
            )
            return {"reply": final_response.text}

        return {"reply": response.text}
        
    except Exception as e:
        print(f"\n!!! EROARE GEMINI DETALIATĂ: {str(e)}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Eroare la comunicarea cu motorul LLM: {str(e)}"
        )