USE donare;
GO

-- 1. Adăugăm coloana pentru momentul ultimei notificări
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('waitlist') AND name = 'notified_at')
BEGIN
    ALTER TABLE waitlist ADD notified_at DATETIME NULL;
END
GO

-- 2. Adăugăm coloana pentru a reține slotul orar oferit utilizatorului
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('waitlist') AND name = 'offered_slot_time')
BEGIN
    ALTER TABLE waitlist ADD offered_slot_time TIME NULL;
END
GO