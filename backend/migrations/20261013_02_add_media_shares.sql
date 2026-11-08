CREATE TABLE IF NOT EXISTS media_shares (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    note VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    max_views INTEGER,
    views_used INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_media_shares_media_id
    ON media_shares (media_id);

CREATE INDEX IF NOT EXISTS idx_media_shares_owner_id
    ON media_shares (owner_id);

CREATE INDEX IF NOT EXISTS idx_media_shares_token
    ON media_shares (token);

CREATE INDEX IF NOT EXISTS idx_media_shares_expires_at
    ON media_shares (expires_at);

CREATE INDEX IF NOT EXISTS idx_media_shares_is_active
    ON media_shares (is_active);
