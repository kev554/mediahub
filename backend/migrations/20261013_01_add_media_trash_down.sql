-- Rollback removes only trash metadata; it does not remove media or R2 objects.
DROP INDEX IF EXISTS ix_media_deleted_by_id;
DROP INDEX IF EXISTS ix_media_deleted_at;

ALTER TABLE media
    DROP COLUMN IF EXISTS deleted_by_id,
    DROP COLUMN IF EXISTS deleted_at;
