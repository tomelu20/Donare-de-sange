USE donare;
GO

IF OBJECT_ID('email_verification_codes', 'U') IS NOT NULL
    DROP TABLE email_verification_codes;
GO

CREATE TABLE email_verification_codes (
    id INT PRIMARY KEY IDENTITY(1,1),
    email VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    verified BIT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0
);
GO