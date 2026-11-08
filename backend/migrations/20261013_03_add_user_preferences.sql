CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'dark',
    language VARCHAR(10) NOT NULL DEFAULT 'fr',
    default_visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    media_sort VARCHAR(20) NOT NULL DEFAULT 'uploaded_at'
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_theme
    ON user_preferences (theme);

CREATE INDEX IF NOT EXISTS idx_user_preferences_language
    ON user_preferences (language);
