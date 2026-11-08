-- Additive migration: preserves all existing media rows and storage objects.
ALTER TABLE media
    ADD COLUMN deleted_at TIMESTAMP NULL,
    ADD COLUMN deleted_by_id INTEGER NULL
        REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX ix_media_deleted_at ON media (deleted_at);
CREATE INDEX ix_media_deleted_by_id ON media (deleted_by_id);
