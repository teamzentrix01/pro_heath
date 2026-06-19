CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(20) NOT NULL
        CHECK (gender IN ('Male', 'Female', 'Other')),
    age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 150),
    contact_number VARCHAR(30) NOT NULL,
    reference TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL
        REFERENCES form_submissions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type VARCHAR(150),
    file_size BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    is_image BOOLEAN NOT NULL DEFAULT FALSE,
    data_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at
    ON form_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_status
    ON form_submissions (status);

CREATE INDEX IF NOT EXISTS idx_submission_documents_submission_id
    ON submission_documents (submission_id);

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_id VARCHAR(150) UNIQUE,
    email VARCHAR(150) UNIQUE,
    password_hash TEXT,
    full_name VARCHAR(150),
    phone_number VARCHAR(10)
        CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{10}$'),
    role VARCHAR(20) NOT NULL DEFAULT 'pro'
        CHECK (role IN ('admin', 'pro')),
    login_count INTEGER NOT NULL DEFAULT 0 CHECK (login_count >= 0),
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    last_user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(10);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'pro';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_ip INET;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS admin_created BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE app_users
SET email = LOWER(COALESCE(email, login_id))
WHERE email IS NULL AND login_id IS NOT NULL;

UPDATE app_users
SET login_id = LOWER(COALESCE(login_id, email))
WHERE login_id IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email
    ON app_users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_last_login_at
    ON app_users (last_login_at DESC);

CREATE TABLE IF NOT EXISTS user_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES app_users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

ALTER TABLE user_login_events ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE user_login_events ADD COLUMN IF NOT EXISTS login_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE user_login_events ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE user_login_events ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id
    ON user_login_events (user_id);

CREATE INDEX IF NOT EXISTS idx_user_login_events_login_at
    ON user_login_events (login_at DESC);

ALTER TABLE form_submissions
    ADD COLUMN IF NOT EXISTS user_id UUID
        REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS admin_seen_at TIMESTAMPTZ;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

ALTER TABLE form_submissions
    ALTER COLUMN contact_number DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id
    ON form_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_admin_seen_at
    ON form_submissions (admin_seen_at, submitted_at DESC);

CREATE TABLE IF NOT EXISTS submission_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL
        REFERENCES form_submissions(id) ON DELETE CASCADE,
    changed_by UUID
        REFERENCES app_users(id) ON DELETE SET NULL,
    from_status VARCHAR(20) NOT NULL,
    to_status VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_status_history_submission
    ON submission_status_history (submission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions (expires_at);

-- Migration: rename role 'user' to 'pro'
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
UPDATE app_users SET role = 'pro' WHERE role = 'user';
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('admin', 'pro'));
