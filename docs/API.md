# Planned API Endpoints
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events` (admin)
- `POST /api/events/:id/register`
- `POST /api/events/:id/check-in`
- `GET /api/events/:id/gallery` (gated by check-in)

## Auth Flows

### Register
- `POST /api/auth/register`
  - body: `{ "fullName": "Jane Doe", "email": "jane@example.com", "password": "Secret123" }`
  - response: `{ "user": { "id": "...", "fullName": "...", "email": "...", "role": "attendee" } }`

### Login
- `POST /api/auth/login`
  - body: `{ "email": "jane@example.com", "password": "Secret123" }`
  - response: `{ "user": { ... }, "accessToken": "...", "refreshToken": "..." }`

### Refresh
- `POST /api/auth/refresh`
  - body: `{ "refreshToken": "<refresh>" }`
  - response: `{ "accessToken": "<newAccess>", "refreshToken": "<rotatedRefresh>" }`

### Logout
- `POST /api/auth/logout`
  - body: `{ "refreshToken": "<refresh>" }`
  - response: `{ "success": true }`

Tokens:
- Access token: short-lived JWT signed with `JWT_SECRET`.
- Refresh token: long-lived JWT signed with `JWT_REFRESH_SECRET`, rotated on every refresh and stored server-side in `user.refreshTokens`.

## Public Events
- `GET /api/events/public`  
  - returns public, published events sorted by startDateTime ascending.
- `GET /api/events/:eventId`  
  - returns event details (no auth required). 404 if not found.

## Admin Events (auth: Bearer access token, role admin)
- `POST /api/admin/events`  
  - body: `{ title, description, location, startDateTime, endDateTime, visibility, published }`  
  - required: `title`, `startDateTime`, `endDateTime`; defaults `visibility=public`, `published=true`.
- `PATCH /api/admin/events/:eventId`  
  - body can include any event fields above to update.

## Event Registration & Check-in
- `POST /api/events/:eventId/register` (auth)  
  - creates registration if none; returns `{ registration }` with `registrationCode`, `qrToken`, `attended=false`.
- `GET /api/events/:eventId/registration/me` (auth)  
  - returns registration for current user; 404 `NOT_REGISTERED` if none.
- `POST /api/events/:eventId/checkin` (auth admin/photographer)  
  - body: `{ registrationCode }` or `{ qrToken }`; marks attended and stamps `checkedInAt`, `checkedInBy`.
- `GET /api/events/:eventId/gallery` (auth)  
  - requires registration; if not registered -> 403 `NOT_REGISTERED`; if not attended -> 403 `NOT_ATTENDED`; else returns `{ media: [] }` placeholder.
