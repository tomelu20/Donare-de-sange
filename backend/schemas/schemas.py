from datetime import date as datetime_date, time, datetime
from typing import Optional, List
import re
from pydantic import BaseModel, EmailStr, field_validator

class UserCreate(BaseModel):
    name: str
    surname: str
    phone: str
    email: EmailStr
    password: str
    blood_group: str
    email_code: str

    @field_validator("phone")
    @classmethod
    def validate_romanian_phone(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^07\d{8}$", v):
            raise ValueError("Numărul de telefon trebuie să conțină exact 10 cifre și să înceapă cu 07 (ex: 07XXXXXXXX).")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Parola trebuie să aibă cel puțin 8 caractere.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Parola trebuie să conțină cel puțin o literă mare.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Parola trebuie să conțină cel puțin o cifră.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Parola trebuie să conțină cel puțin un caracter special.")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    surname: str
    phone: str
    email: EmailStr
    role: Optional[str] = "user"
    blood_group: Optional[str] = "Nu știu"

    model_config = {"from_attributes": True}

class CampaignCreate(BaseModel):
    title: str
    location_name: str
    address: str
    date: datetime_date
    end_date: Optional[datetime_date] = None  
    start_time: time
    end_time: time
    slot_duration: int
    capacity_per_slot: int

class CampaignOut(BaseModel):
    id: int
    title: str
    location_name: str
    address: str
    date: datetime_date
    end_date: Optional[datetime_date] = None  
    start_time: time
    end_time: time
    slot_duration: int
    capacity_per_slot: int
    is_active: bool

    model_config = {"from_attributes": True}

class AppointmentCreate(BaseModel):
    campaign_id: int
    slot_time: time
    user_id: int
    appointment_date: datetime_date
    is_for_someone_else: bool = False
    guest_name: Optional[str] = None
    guest_surname: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[EmailStr] = None
    guest_blood_group: Optional[str] = "Nu știu"

    @field_validator("guest_phone")
    @classmethod
    def validate_guest_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not re.match(r"^07\d{8}$", v):
                raise ValueError("Numărul de telefon al invitatului trebuie să aibă exact 10 cifre și să înceapă cu 07.")
        return v

class AppointmentOut(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    slot_time: time
    status: str
    created_at: datetime
    appointment_date: Optional[datetime_date] = None
    campaign_title: Optional[str] = None

    model_config = {"from_attributes": True}

class WaitlistCreate(BaseModel):
    campaign_id: int
    user_id: int
    name: str
    surname: str
    phone: str
    email: EmailStr
    preferred_time_range: str
    travel_time_minutes: int

    @field_validator("phone")
    @classmethod
    def validate_waitlist_phone(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^07\d{8}$", v):
            raise ValueError("Numărul de telefon trebuie să aibă exact 10 cifre și să înceapă cu 07.")
        return v

class WaitlistOut(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    name: str
    surname: str
    phone: str
    email: EmailStr
    preferred_time_range: str
    travel_time_minutes: int
    status: str

    model_config = {"from_attributes": True}

class QuestionOut(BaseModel):
    id: int
    question_text: str
    type: str
    is_required: Optional[bool] = True
    is_active: Optional[bool] = True

    model_config = {"from_attributes": True}

class AnswerSubmit(BaseModel):
    question_id: int
    answer_text: str

class AppointmentWithAnswersCreate(BaseModel):
    appointment: AppointmentCreate
    answers: List[AnswerSubmit]

class SlotOut(BaseModel):
    time: str
    available_slots: int
    is_available: bool
    date: str