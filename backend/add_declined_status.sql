USE donare;
GO

-- 1. Identificăm și ștergem regula veche (CHECK constraint)
ALTER TABLE waitlist DROP CONSTRAINT CK__waitlist__status__5812160E;
GO

-- 2. Adăugăm noua regulă care include și starea 'declined'
ALTER TABLE waitlist ADD CONSTRAINT CK_waitlist_status 
CHECK (status IN ('waiting', 'notified', 'accepted', 'expired', 'declined'));
GO