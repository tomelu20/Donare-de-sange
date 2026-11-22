import os
import unittest
from types import SimpleNamespace

os.environ.update(
    {
        "ENV": "development",
        "DATABASE_URL": "sqlite://",
        "SECRET_KEY": "test-only-secret-key",
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "480",
        "CORS_ORIGINS": "http://localhost",
        "FRONTEND_URL": "http://localhost:5173",
        "GEMINI_API_KEY": "test-only-key",
        "EMAIL_USER": "",
        "EMAIL_PASSWORD": "",
    }
)

from config import Settings
from fastapi import HTTPException
from models import User, UserRole
from pydantic import ValidationError
from routers.auth import ensure_owner_or_admin
from schemas.schemas import UserCreate


class CampaignNotificationPreferenceTests(unittest.TestCase):
    def create_user_payload(self, **overrides):
        payload = {
            "name": "Ana",
            "surname": "Donator",
            "phone": "0712345678",
            "email": "ana@example.com",
            "password": "ValidPass1!",
            "email_code": "123456",
        }
        payload.update(overrides)
        return UserCreate(**payload)

    def test_registration_payload_preserves_opt_in(self):
        user_data = self.create_user_payload(notify_campaigns=True)

        self.assertTrue(user_data.notify_campaigns)

    def test_registration_defaults_to_no_campaign_emails(self):
        user_data = self.create_user_payload()

        self.assertFalse(user_data.notify_campaigns)

    def test_user_model_persists_campaign_preference(self):
        column = User.__table__.c.notify_campaigns
        user = User(notify_campaigns=True)

        self.assertFalse(column.nullable)
        self.assertFalse(column.default.arg)
        self.assertTrue(user.notify_campaigns)


class ProductionConfigurationTests(unittest.TestCase):
    def production_settings(self, **overrides):
        values = {
            "ENV": "production",
            "DATABASE_URL": "sqlite://",
            "SECRET_KEY": "s" * 48,
            "ALGORITHM": "HS256",
            "CORS_ORIGINS": "https://donare.example",
            "FRONTEND_URL": "https://donare.example",
            "GEMINI_API_KEY": "",
            "EMAIL_USER": "mailer@example.com",
            "EMAIL_PASSWORD": "test-only-password",
        }
        values.update(overrides)
        return Settings(**values)

    def test_production_accepts_secure_configuration(self):
        settings = self.production_settings()

        self.assertEqual(settings.ENV, "production")

    def test_production_rejects_short_signing_key(self):
        with self.assertRaises(ValidationError):
            self.production_settings(SECRET_KEY="too-short")

    def test_production_rejects_insecure_cors_origins(self):
        with self.assertRaises(ValidationError):
            self.production_settings(CORS_ORIGINS="http://donare.example")

    def test_production_requires_frontend_origin_in_cors_allowlist(self):
        with self.assertRaises(ValidationError):
            self.production_settings(CORS_ORIGINS="https://api.example")


class ResourceAuthorizationTests(unittest.TestCase):
    def test_owner_and_admin_are_allowed_but_other_users_are_rejected(self):
        owner = SimpleNamespace(id=1, role=UserRole.USER)
        admin = SimpleNamespace(id=2, role=UserRole.ADMIN)
        other_user = SimpleNamespace(id=3, role=UserRole.USER)

        ensure_owner_or_admin(1, owner)
        ensure_owner_or_admin(1, admin)

        with self.assertRaises(HTTPException) as error:
            ensure_owner_or_admin(1, other_user)

        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
