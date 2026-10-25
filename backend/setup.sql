/*
    Safe, repeatable setup and schema migration for the Donare application.

    Run with SQL Server Management Studio or sqlcmd. This script creates the
    "donare" database only when it does not already exist. It does not drop
    databases, tables, or rows.
*/
IF DB_ID(N'donare') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [donare]');
END
GO

USE [donare];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.users (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            surname VARCHAR(100) NOT NULL,
            phone VARCHAR(15) NOT NULL,
            email VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            blood_group VARCHAR(10) NOT NULL CONSTRAINT DF_users_blood_group DEFAULT ('Nu știu'),
            role VARCHAR(50) NOT NULL CONSTRAINT DF_users_role DEFAULT ('user'),
            CONSTRAINT UQ_users_email UNIQUE (email),
            CONSTRAINT CK_users_role CHECK (role IN ('user', 'admin'))
        );
    END;

    IF OBJECT_ID(N'dbo.campaigns', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.campaigns (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_campaigns PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            location_name VARCHAR(255) NOT NULL,
            address VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            end_date DATE NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            slot_duration INT NOT NULL,
            capacity_per_slot INT NOT NULL,
            is_active BIT NOT NULL CONSTRAINT DF_campaigns_is_active DEFAULT (1)
        );
    END;

    IF OBJECT_ID(N'dbo.appointments', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.appointments (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_appointments PRIMARY KEY,
            campaign_id INT NOT NULL,
            user_id INT NOT NULL,
            slot_time TIME NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at DATETIME NOT NULL CONSTRAINT DF_appointments_created_at DEFAULT (GETDATE()),
            is_for_someone_else BIT NOT NULL CONSTRAINT DF_appointments_is_for_someone_else DEFAULT (0),
            guest_name VARCHAR(100) NULL,
            guest_surname VARCHAR(100) NULL,
            guest_phone VARCHAR(15) NULL,
            guest_email VARCHAR(100) NULL,
            guest_blood_group VARCHAR(10) NULL CONSTRAINT DF_appointments_guest_blood_group DEFAULT ('Nu știu'),
            appointment_date DATE NULL,
            notes VARCHAR(500) NULL,
            CONSTRAINT FK_appointments_campaigns FOREIGN KEY (campaign_id) REFERENCES dbo.campaigns(id),
            CONSTRAINT FK_appointments_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
            CONSTRAINT CK_appointments_status CHECK (status IN ('confirmed', 'cancelled', 'attended', 'no_show'))
        );
    END;

    IF OBJECT_ID(N'dbo.waitlist', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.waitlist (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_waitlist PRIMARY KEY,
            campaign_id INT NOT NULL,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            surname VARCHAR(100) NOT NULL,
            phone VARCHAR(15) NOT NULL,
            email VARCHAR(100) NOT NULL,
            preferred_time_range VARCHAR(100) NOT NULL,
            travel_time_minutes INT NOT NULL,
            status VARCHAR(50) NOT NULL,
            notified_at DATETIME NULL,
            offered_slot_time TIME NULL,
            CONSTRAINT FK_waitlist_campaigns FOREIGN KEY (campaign_id) REFERENCES dbo.campaigns(id),
            CONSTRAINT FK_waitlist_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
            CONSTRAINT CK_waitlist_status CHECK (status IN ('waiting', 'notified', 'accepted', 'expired', 'declined'))
        );
    END;

    IF OBJECT_ID(N'dbo.eligibility_questions', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.eligibility_questions (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_eligibility_questions PRIMARY KEY,
            question_text VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            is_required BIT NOT NULL CONSTRAINT DF_eligibility_questions_is_required DEFAULT (1),
            is_active BIT NOT NULL CONSTRAINT DF_eligibility_questions_is_active DEFAULT (1),
            CONSTRAINT CK_eligibility_questions_type CHECK (type IN ('checkbox', 'radio', 'numeric'))
        );
    END;

    IF OBJECT_ID(N'dbo.eligibility_answers', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.eligibility_answers (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_eligibility_answers PRIMARY KEY,
            appointment_id INT NOT NULL,
            question_id INT NOT NULL,
            answer_text VARCHAR(255) NOT NULL,
            CONSTRAINT FK_eligibility_answers_appointments FOREIGN KEY (appointment_id) REFERENCES dbo.appointments(id),
            CONSTRAINT FK_eligibility_answers_questions FOREIGN KEY (question_id) REFERENCES dbo.eligibility_questions(id)
        );
    END;

    IF OBJECT_ID(N'dbo.email_verification_codes', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.email_verification_codes (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_email_verification_codes PRIMARY KEY,
            email VARCHAR(100) NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            verified BIT NOT NULL CONSTRAINT DF_email_verification_codes_verified DEFAULT (0),
            attempts INT NOT NULL CONSTRAINT DF_email_verification_codes_attempts DEFAULT (0)
        );
    END;

    /*
        Bring older installations up to date. New columns are nullable or have
        defaults so existing rows remain valid and are not removed.
    */
    IF COL_LENGTH(N'dbo.campaigns', N'end_date') IS NULL
    BEGIN
        ALTER TABLE dbo.campaigns ADD end_date DATE NULL;
    END;

    UPDATE dbo.campaigns
    SET end_date = [date]
    WHERE end_date IS NULL;

    IF COL_LENGTH(N'dbo.appointments', N'is_for_someone_else') IS NULL
        ALTER TABLE dbo.appointments ADD is_for_someone_else BIT NOT NULL
            CONSTRAINT DF_appointments_is_for_someone_else DEFAULT (0);

    IF COL_LENGTH(N'dbo.appointments', N'guest_name') IS NULL
        ALTER TABLE dbo.appointments ADD guest_name VARCHAR(100) NULL;

    IF COL_LENGTH(N'dbo.appointments', N'guest_surname') IS NULL
        ALTER TABLE dbo.appointments ADD guest_surname VARCHAR(100) NULL;

    IF COL_LENGTH(N'dbo.appointments', N'guest_phone') IS NULL
        ALTER TABLE dbo.appointments ADD guest_phone VARCHAR(15) NULL;

    IF COL_LENGTH(N'dbo.appointments', N'guest_email') IS NULL
        ALTER TABLE dbo.appointments ADD guest_email VARCHAR(100) NULL;

    IF COL_LENGTH(N'dbo.appointments', N'guest_blood_group') IS NULL
        ALTER TABLE dbo.appointments ADD guest_blood_group VARCHAR(10) NULL
            CONSTRAINT DF_appointments_guest_blood_group DEFAULT ('Nu știu');

    IF COL_LENGTH(N'dbo.appointments', N'appointment_date') IS NULL
        ALTER TABLE dbo.appointments ADD appointment_date DATE NULL;

    IF COL_LENGTH(N'dbo.appointments', N'notes') IS NULL
        ALTER TABLE dbo.appointments ADD notes VARCHAR(500) NULL;

    IF COL_LENGTH(N'dbo.appointments', N'is_for_someone_else') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.default_constraints dc
           JOIN sys.columns c
             ON c.object_id = dc.parent_object_id
            AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID(N'dbo.appointments')
             AND c.name = N'is_for_someone_else'
       )
    BEGIN
        ALTER TABLE dbo.appointments
            ADD CONSTRAINT DF_appointments_is_for_someone_else DEFAULT (0) FOR is_for_someone_else;
    END;

    IF COL_LENGTH(N'dbo.appointments', N'guest_blood_group') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.default_constraints dc
           JOIN sys.columns c
             ON c.object_id = dc.parent_object_id
            AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID(N'dbo.appointments')
             AND c.name = N'guest_blood_group'
       )
    BEGIN
        ALTER TABLE dbo.appointments
            ADD CONSTRAINT DF_appointments_guest_blood_group DEFAULT ('Nu știu') FOR guest_blood_group;
    END;

    IF COL_LENGTH(N'dbo.waitlist', N'notified_at') IS NULL
        ALTER TABLE dbo.waitlist ADD notified_at DATETIME NULL;

    IF COL_LENGTH(N'dbo.waitlist', N'offered_slot_time') IS NULL
        ALTER TABLE dbo.waitlist ADD offered_slot_time TIME NULL;

    IF COL_LENGTH(N'dbo.waitlist', N'preferred_time_range') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.waitlist')
             AND name = N'preferred_time_range'
             AND system_type_id = TYPE_ID(N'varchar')
             AND max_length < 100
       )
    BEGIN
        ALTER TABLE dbo.waitlist ALTER COLUMN preferred_time_range VARCHAR(100) NOT NULL;
    END;

    IF COL_LENGTH(N'dbo.eligibility_questions', N'is_required') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.default_constraints dc
           JOIN sys.columns c
             ON c.object_id = dc.parent_object_id
            AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID(N'dbo.eligibility_questions')
             AND c.name = N'is_required'
       )
    BEGIN
        ALTER TABLE dbo.eligibility_questions
            ADD CONSTRAINT DF_eligibility_questions_is_required DEFAULT (1) FOR is_required;
    END;

    IF COL_LENGTH(N'dbo.eligibility_questions', N'is_active') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.default_constraints dc
           JOIN sys.columns c
             ON c.object_id = dc.parent_object_id
            AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID(N'dbo.eligibility_questions')
             AND c.name = N'is_active'
       )
    BEGIN
        ALTER TABLE dbo.eligibility_questions
            ADD CONSTRAINT DF_eligibility_questions_is_active DEFAULT (1) FOR is_active;
    END;

    /*
        Replace legacy status CHECK constraints with the statuses used by the
        current application. Abort and roll back if existing values do not fit.
    */
    IF EXISTS (
        SELECT 1
        FROM dbo.appointments
        WHERE status IS NULL
           OR status NOT IN ('confirmed', 'cancelled', 'attended', 'no_show')
    )
        THROW 50001, 'Appointments contain a status not supported by the current schema; no changes were committed.', 1;

    DECLARE @constraint_name SYSNAME;
    DECLARE @drop_constraint_sql NVARCHAR(MAX);

    DECLARE appointment_status_constraints CURSOR LOCAL FAST_FORWARD FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'dbo.appointments')
          AND cc.definition LIKE N'%status%';

    OPEN appointment_status_constraints;
    FETCH NEXT FROM appointment_status_constraints INTO @constraint_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @drop_constraint_sql =
            N'ALTER TABLE dbo.appointments DROP CONSTRAINT ' + QUOTENAME(@constraint_name) + N';';
        EXEC sys.sp_executesql @drop_constraint_sql;
        FETCH NEXT FROM appointment_status_constraints INTO @constraint_name;
    END;
    CLOSE appointment_status_constraints;
    DEALLOCATE appointment_status_constraints;

    ALTER TABLE dbo.appointments
        ADD CONSTRAINT CK_appointments_status
        CHECK (status IN ('confirmed', 'cancelled', 'attended', 'no_show'));

    IF EXISTS (
        SELECT 1
        FROM dbo.waitlist
        WHERE status IS NULL
           OR status NOT IN ('waiting', 'notified', 'accepted', 'expired', 'declined')
    )
        THROW 50002, 'Waitlist contains a status not supported by the current schema; no changes were committed.', 1;

    DECLARE waitlist_status_constraints CURSOR LOCAL FAST_FORWARD FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'dbo.waitlist')
          AND cc.definition LIKE N'%status%';

    OPEN waitlist_status_constraints;
    FETCH NEXT FROM waitlist_status_constraints INTO @constraint_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @drop_constraint_sql =
            N'ALTER TABLE dbo.waitlist DROP CONSTRAINT ' + QUOTENAME(@constraint_name) + N';';
        EXEC sys.sp_executesql @drop_constraint_sql;
        FETCH NEXT FROM waitlist_status_constraints INTO @constraint_name;
    END;
    CLOSE waitlist_status_constraints;
    DEALLOCATE waitlist_status_constraints;

    ALTER TABLE dbo.waitlist
        ADD CONSTRAINT CK_waitlist_status
        CHECK (status IN ('waiting', 'notified', 'accepted', 'expired', 'declined'));

    COMMIT TRANSACTION;
    PRINT 'Donare database schema is ready. Existing data has been preserved.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
