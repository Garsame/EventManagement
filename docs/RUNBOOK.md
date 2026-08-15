# Runbook

1. Install Node.js 18+ and ensure MongoDB is running locally.
2. Copy `backend/.env.example` to `backend/.env` and adjust values if needed.
3. Start backend: `cd backend && npm install && npm run dev`.
4. Start frontend: `cd frontend && npm install && npm run dev`.
5. Verify health at `http://localhost:<PORT>/api/health` and UI at http://localhost:5173.

## Ports

`.env.example` ships with `PORT=5000`, but **this machine runs the backend on
5099** because an unrelated process already holds 5000. Check before assuming
5000 is free:

```
netstat -ano | findstr :5000
```

Two things must stay in sync with whatever port the backend actually binds:

- `frontend/.env` -> `VITE_API_BASE_URL`
- `backend/.env` -> `CORS_ORIGIN` must match the frontend origin exactly

The frontend must come up on **5173**. If Vite falls back to 5174 because
something is squatting on 5173, every API call fails CORS. On Windows, stopping
an `npm run dev` task does not kill the node/vite child it spawned, so find the
real PID and stop it directly rather than re-running npm:

```
netstat -ano | findstr :5173
```

The curl examples below use `:5099`; change it if your port differs.

## Troubleshooting

- Port in use: change `PORT` or `CORS_ORIGIN` in `.env`.
- Mongo unreachable: confirm `mongod` service is running and `MONGO_URI` matches.
- Upload returns 503 `MEDIA_STORAGE_UNCONFIGURED`: `MEDIA_STORAGE=cloudinary`
  is set without credentials. Add them, or set `MEDIA_STORAGE=local`.
- Uploaded images 404 or fail to load: `PUBLIC_BASE_URL` must match the port the
  backend actually binds, because the browser loads them from a different origin
  than the frontend.
- Auth returns 429 `TOO_MANY_ATTEMPTS`: the rate limit is 30 requests per 15
  minutes per IP. The counter is in memory, so restarting the backend clears it.

## Environment Variables

- `PORT` (default 5000; 5099 on this machine)
- `MONGO_URI` — must include the database name
- `MONGO_DB_NAME` — optional override, used by the test suite
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (e.g., 15m)
- `REFRESH_TOKEN_EXPIRES_IN` (e.g., 7d)
- `CORS_ORIGIN` (default http://localhost:5173)
- `MEDIA_STORAGE` — `local` (default) or `cloudinary`
- `PUBLIC_BASE_URL` — base URL for locally stored media links
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — only
  when `MEDIA_STORAGE=cloudinary`
- `MEDIA_MAX_FILE_SIZE_MB` (default 10)

## Media Storage

Uploads default to local disk (`backend/uploads`, gitignored), so no third-party
account is needed — relevant because Cloudinary blocks signups from some
countries. Files are served read-only from `/uploads` with random 32-character
names.

To switch to Cloudinary later, set `MEDIA_STORAGE=cloudinary` and fill in the
three credentials. No code changes are required; both drivers implement the same
interface in `src/config/storage.js`.

## Seeding

Run once after setting `.env`:

```
cd backend
npm run seed
```

Creates three accounts and the five demo events used by the Events page:

- `admin@example.com` / `Admin123!`
- `photographer@example.com` / `Photo123!`
- `attendee@example.com` / `Attend123!` (not registered for anything, and with a
  deliberately empty profile, so both the profile-completion gate and the
  register -> check-in -> gallery flow can be shown from the start)

## Attendee Dashboard

Signed-in users get a `Dashboard` link in the main navigation and an avatar menu
in place of the Log in / Register buttons. The avatar shows the uploaded photo,
or the user's initials until one is set.

- `/dashboard` — counts of events joined, attended, awaiting check-in, and
  photos available, plus the next upcoming event
- `/dashboard/events` — every registration with a Registered → Checked in →
  Gallery progress bar, filters, and the registration code
- `/dashboard/profile` — view and edit the full profile, upload or remove a photo

**Registration is blocked until the profile is complete.** The required fields
are mobile number, location, institution, highest education level, and sex.
Field of study is optional because it does not apply to everyone. The rule is
enforced in the API (`403 PROFILE_INCOMPLETE`), not only in the UI.

## Theme

A light/dark toggle sits in the navbar and applies to both the public site and
the dashboard. The choice is stored in `localStorage` under `ems_theme`; with no
stored choice the OS preference is followed. `index.html` applies the class
before first paint so dark-mode users do not get a white flash.

Safe to re-run — users are keyed by email and events by title, so nothing is
duplicated or overwritten.

## Tests

```
cd backend
npm test
```

Runs against a separate `event_media_test` database and drops it afterwards, so
development data is untouched. Covers the gallery gate, role guards, and
registration behaviour.

## Quick Auth Test

1) Register: `curl -X POST http://localhost:5099/api/auth/register -H "Content-Type: application/json" -d '{"fullName":"Test User","email":"test@example.com","password":"Secret123"}'`
2) Login: `curl -X POST http://localhost:5099/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Secret123"}'`
3) Refresh: `curl -X POST http://localhost:5099/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<refresh>"}'`
4) Logout: `curl -X POST http://localhost:5099/api/auth/logout -H "Content-Type: application/json" -d '{"refreshToken":"<refresh>"}'`

## Events Module Tests (admin token required)

1) Login as admin (after seeding) to get `accessToken`:  
`ACCESS=$(curl -s -X POST http://localhost:5099/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"Admin123!"}' | jq -r '.accessToken')`
2) Create event:  
`curl -X POST http://localhost:5099/api/admin/events -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" -d '{"title":"Launch Party","startDateTime":"2026-03-01T18:00:00Z","endDateTime":"2026-03-01T21:00:00Z","location":"Main Hall","visibility":"public","published":true}'`
3) List public events: `curl http://localhost:5099/api/events/public`
4) Fetch details: `curl http://localhost:5099/api/events/<eventId>`

## Registration & Check-in Flow

1) Register as attendee (auth required):  
`curl -X POST http://localhost:5099/api/events/<eventId>/register -H "Authorization: Bearer <attendeeAccess>" -H "Content-Type: application/json"`
2) Check registration status:  
`curl http://localhost:5099/api/events/<eventId>/registration/me -H "Authorization: Bearer <attendeeAccess>"`
3) Admin/photographer check-in attendee using code or token:  
`curl -X POST http://localhost:5099/api/events/<eventId>/checkin -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" -d '{"registrationCode":"EVT-XXXXXX"}'`
4) Gallery gate (only after attended=true):  
`curl http://localhost:5099/api/events/<eventId>/gallery -H "Authorization: Bearer <attendeeAccess>"`

In the UI, the attendee sees a scannable QR code of their `qrToken` on the
registration status page, and staff scan it (or type the code) at
`/admin/checkin`.
