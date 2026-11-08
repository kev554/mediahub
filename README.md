# MediaHub

MediaHub is a personal media library with a React/TypeScript frontend and a
FastAPI backend. PostgreSQL stores accounts and media metadata; Cloudflare R2
stores original files and thumbnails.

## Current project structure

- `frontend/`: React 19, TypeScript and Vite application.
- `backend/app/routers/`: authentication, media, albums, groups and user API.
- `backend/app/models/`: SQLAlchemy models for users, media, albums, groups and
  personal media favorites.
- `backend/app/services/`: media permissions, metadata and file storage.

The API currently exposes `/api/auth`, `/api/media`, `/api/albums`,
`/api/groups`, `/api/users`, `/api/trash` and `/api/health`. The frontend uses `/api` by
default; set `VITE_API_URL` to the backend API base URL when deploying it
separately (for example, `https://api.example.com/api`).

Group roles are enforced by the API: Owners control membership and roles,
Managers can upload and organize group media, and Viewers have read-only
access. Existing database rows with the legacy `member` role are returned and
authorized as Managers, preserving their current capabilities without a
destructive data migration. New members default to Viewer unless the Owner
chooses Manager.

## Local development

### Backend

1. Create and activate a Python virtual environment in `backend/`.
2. Install dependencies with `python -m pip install -r requirements.txt`.
3. Copy `backend/.env.example` to `backend/.env` and provide valid PostgreSQL,
   JWT and R2 settings.
4. Start the API from `backend/`:

   ```powershell
   python -m uvicorn app.main:app --reload
   ```

The API documentation is available at `/docs`. Image thumbnails use Pillow;
video metadata and thumbnails require `ffprobe` and `ffmpeg` on `PATH`.

For a complete local stack, copy `backend/.env.example` to `backend/.env`,
replace `JWT_SECRET` with a random value, then run `docker compose up --build`.
Compose starts PostgreSQL, MinIO, creates the local bucket, and starts the API
on port 8000. The API container uses MinIO; it does not use the R2 credentials
in the environment file. Start the frontend separately with `npm run dev` in
`frontend/`. The first local database is initialized from the current models.
For an existing database, apply the versioned SQL migrations before deploying;
`create_tables.py` does not upgrade existing tables.

### Frontend

Install dependencies in `frontend/` with `npm install`, then start Vite with
`npm run dev`. Run `npm run build` for the TypeScript check and production
build, and `npm run lint` for linting.

To open the development site on a phone with HTTPS (required for camera access):

1. On Windows, install mkcert with
   `winget install --id FiloSottile.mkcert -e`.
2. In PowerShell, from `frontend/`, run
   `.\setup-https.ps1` (or `powershell -ExecutionPolicy Bypass -File .\setup-https.ps1`).
   The script creates a trusted local CA on the PC, generates a certificate
   for its Wi-Fi IPv4 address, and copies the public CA certificate to
   `frontend/.devcerts/phone-rootCA.pem`.
3. Transfer only `phone-rootCA.pem` to the phone and install it as a trusted
   CA certificate in the phone's security settings. Trust installation differs
   between Android and iOS. Never transfer `rootCA-key.pem`.
4. Restart Vite with `npm run dev` in `frontend/`. Open the HTTPS address
   printed by the script on the phone, with both devices on the same Wi-Fi.
   Allow Node/Vite through Windows Firewall for private networks if prompted.

Vite enables HTTPS automatically when its generated certificate and key are
present in the ignored `frontend/.devcerts/` directory. The existing `/api`
proxy continues forwarding requests to the local backend on port 8000.

## Configuration

Backend settings are read from environment variables or `backend/.env`.
`backend/.env.example` lists the required database, JWT and R2 variables.
`CORS_ORIGINS` is a JSON array of exact allowed origins, including the scheme;
`MAX_FILE_SIZE_BYTES` defaults to 5 GiB and `TRASH_RETENTION_DAYS` to 30 days.
`STORAGE_QUOTA_BYTES` optionally enables the per-user storage usage bar.
`R2_PUBLIC_ENDPOINT_URL` can override the address used for short-lived browser
streaming links when the storage endpoint has a different public hostname.

Never commit `.env` files or put backend secrets in frontend variables. The
frontend's `VITE_*` variables are included in the browser bundle.
When using Cloudflare R2, configure the bucket's CORS policy to allow the
frontend origin and `GET` requests, including the `Range` header. Video playback
and downloads use short-lived, five-minute signed URLs so large files stream
from object storage rather than being buffered in API or browser memory.

## Data safety and migration status

The versioned SQL files in `backend/migrations/` add trash, share links and
account preferences. Back up and verify the database before applying them in
order, and apply them before deploying the matching API version. For example,
from the repository root in PowerShell:

```powershell
psql $env:PG_CONNINFO -v ON_ERROR_STOP=1 -f backend\migrations\20261013_01_add_media_trash.sql
psql $env:PG_CONNINFO -v ON_ERROR_STOP=1 -f backend\migrations\20261013_02_add_media_shares.sql
psql $env:PG_CONNINFO -v ON_ERROR_STOP=1 -f backend\migrations\20261013_03_add_user_preferences.sql
```

`PG_CONNINFO` must be a PostgreSQL/libpq connection string (for example,
`postgresql://user:password@host:5432/database`); the SQLAlchemy
`DATABASE_URL` commonly uses a driver suffix and should not be passed directly
to `psql`.

The paired `_down.sql` removes only the two trash columns and their indexes;
rolling it back makes trashed media visible again, so restore or permanently
purge trash entries before using it. `backend/create_tables.py` calls
`Base.metadata.create_all`; it is not a migration tool and must not be treated
as one for production schema changes. Do not run destructive schema or storage
operations against production without a verified backup and explicit approval.

Media deletion now moves a record to the deleting user's trash without
deleting its R2 objects. That user can restore items or explicitly delete them
permanently. The configured retention period is exposed in the trash UI.
On Windows, `backend/install_trash_purge_task.ps1` can register a daily
Task Scheduler task (default 03:00 local time). Review the active backend
`.env`, confirm the database and R2 bucket, then run from PowerShell:

```powershell
cd backend
.\install_trash_purge_task.ps1 -Register
```

The task runs as the current Windows user while that user is logged in.
`-Time "HH:mm"` changes the local run time, and `-Unregister` removes the task.
Purge output is recorded in `backend/logs/trash-purge.log` with rotation.
The task is not registered automatically by the application. Test against a
staging database and storage bucket before registering it for production.
Expired items cannot be restored even if the scheduled purge has not run yet.

## Share links

The API now supports secure media share links with a generated token, optional
expiration window, and optional view cap. Share links are created by the media
owner or a group manager, can be revoked at any time, and become invalid once
their expiration or visit limit is reached. Public access is limited to the
matching media object and its original file, with the link token serving as the
shared secret.

## Search, smart albums, duplicates and offline use

The library search supports media type, album, favorite-only and inclusive date
range filters. Date filtering and smart albums use the capture date when
available, falling back to the upload date. Smart albums are grouped by year,
month and day and replace the former Timeline navigation entry; location-based
collections are not available because media records do not currently store GPS
coordinates. The Albums page also generates a live monthly album section
alongside user-created albums; these collections are computed from the current
library and are not separate database records. It also groups media into
meteorological seasons (March–May, June–August, September–November and
December–February) and fixed-date holidays for Cameroon and Russia, including
Christmas and New Year. Holiday groupings use photos' capture date or upload
date, and may overlap (for example Orthodox Christmas falls in Russia's New
Year holiday period). Movable holidays and birthdays are not inferred; support
for birthdays requires a personal calendar.

The Duplicates page compares SHA-256 hashes for the current user's own files
with matching file sizes. A scan reads those candidate files from object
storage and may take time for large libraries. It only reports exact matches;
each move to trash requires an explicit user action.

The frontend is installable as a PWA and caches its app shell. While signed in,
viewed media and thumbnails are cached locally for offline use, with an
approximate 300 MiB overall cap and a 100 MiB per-file limit. Large videos over
that limit remain online-only. Offline access requires having opened the app
while connected and having viewed the media beforehand. Logging out clears the
local offline media and account cache.

## Animated appearance

The Preferences page offers an optional animated aurora background with an
adjustable intensity. Its setting is saved in the current browser on the
device, independently of account preferences. The effect respects the
operating system's reduced-motion preference.

## Camera capture

The camera page supports photo and video capture, including optional background
blur modes. Background blur uses MediaPipe Selfie Segmentation: its model assets
are downloaded from jsDelivr the first time a blur mode is selected, while
camera frames are processed locally in the browser and are not sent to that
service. Blur capture stays unavailable until the model and first segmentation
mask are ready. Optional face-tracked glasses, cat ears, and crown overlays use
MediaPipe Face Mesh, loaded from jsDelivr the first time a mask is selected.
Face tracking and camera frames are processed locally in the browser and are
not sent to jsDelivr. Mask capture stays unavailable until face tracking is
ready. Camera access requires a secure context (HTTPS, or localhost).

## Resumable uploads

Media uploads are sent in sequential 8 MiB chunks and can continue from the
last acknowledged byte after a network interruption. The browser retains the
upload ID locally and resumes when the same file is selected again. Incomplete
upload data is stored under the configured temporary storage directory on the
API host and expires after 24 hours. The API host must therefore use persistent
temporary storage if uploads need to survive a server restart; no database
migration is required.

Account-synchronized preferences are stored per user and managed through the
account settings page.