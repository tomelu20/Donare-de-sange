import datetime
import enum
from sqlalchemy import Column, Integer, String, Date, Time, Boolean, DateTime, ForeignKey, Enum, text
from sqlalchemy.orm import relationship
from database import Base

class UserRole(str, enum.Enum):
    USER = 'user'
    ADMIN = 'admin'

class AppointmentStatus(str, enum.Enum):
    CONFIRMED = 'confirmed'
    CANCELLED = 'cancelled'
    ATTENDED = 'attended'
    NO_SHOW = 'no_show'

class WaitlistStatus(str, enum.Enum):
    WAITING = 'waiting'
    NOTIFIED = 'notified'
    ACCEPTED = 'accepted'
    EXPIRED = 'expired'

class QuestionType(str, enum.Enum):
    CHECKBOX = 'checkbox'
    RADIO = 'radio'
    NUMERIC = 'numeric'

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    surname = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role_check"), nullable=False, default=UserRole.USER)
    blood_group = Column(String(10), default="Nu știu", nullable=False)

    appointments = relationship("Appointment", back_populates="user", cascade="all, delete-orphan")
    waitlist_entries = relationship("Waitlist", back_populates="user", cascade="all, delete-orphan")


class Campaign(Base):
    __tablename__ = 'campaigns'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    location_name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)  # <--- MODIFICAT: Am adăugat coloana lipsă
    slot_duration = Column(Integer, nullable=False)
    capacity_per_slot = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    
    appointments = relationship("Appointment", back_populates="campaign", cascade="all, delete-orphan")
    waitlist_entries = relationship("Waitlist", back_populates="campaign", cascade="all, delete-orphan")

class Appointment(Base):
    __tablename__ = 'appointments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    slot_time = Column(Time, nullable=False)
    status = Column(Enum(AppointmentStatus, name="appointment_status_check"), nullable=False)
    created_at = Column(DateTime, server_default=text("GETDATE()"))
    
    # --- CÂMPURI NOI PENTRU INVITAȚI ---
    is_for_someone_else = Column(Boolean, nullable=False, default=False)
    guest_name = Column(String(100), nullable=True)
    guest_surname = Column(String(100), nullable=True)
    guest_phone = Column(String(15), nullable=True)
    guest_email = Column(String(100), nullable=True)
    guest_blood_group = Column(String(10), nullable=True, default="Nu știu")
    appointment_date = Column(Date, nullable=True)
    notes = Column(String(500), nullable=True)
    
    campaign = relationship("Campaign", back_populates="appointments")
    user = relationship("User", back_populates="appointments")
    eligibility_answers = relationship("EligibilityAnswer", back_populates="appointment", cascade="all, delete-orphan")

class Waitlist(Base):
    __tablename__ = 'waitlist'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(100), nullable=False)
    surname = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=False)
    email = Column(String(100), nullable=False)
    preferred_time_range = Column(String(50), nullable=False)
    travel_time_minutes = Column(Integer, nullable=False)
    status = Column(Enum(WaitlistStatus, name="waitlist_status_check"), nullable=False, default=WaitlistStatus.WAITING)
    
    campaign = relationship("Campaign", back_populates="waitlist_entries")
    user = relationship("User", back_populates="waitlist_entries")


class EligibilityQuestion(Base):
    __tablename__ = 'eligibility_questions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    question_text = Column(String(255), nullable=False)
    type = Column(Enum(QuestionType, name="question_type_check"), nullable=False)
    is_required = Column(Boolean, nullable=True)
    is_active = Column(Boolean, nullable=True)
    
    answers = relationship("EligibilityAnswer", back_populates="question", cascade="all, delete-orphan")


class EligibilityAnswer(Base):
    __tablename__ = 'eligibility_answers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=False)
    question_id = Column(Integer, ForeignKey('eligibility_questions.id'), nullable=False)
    answer_text = Column(String(255), nullable=False)
    
    appointment = relationship("Appointment", back_populates="eligibility_answers")
    question = relationship("EligibilityQuestion", back_populates="answers")