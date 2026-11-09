# API

Base URL `http://localhost:5099/api` on this machine (see RUNBOOK.md — the
`.env.example` default of 5000 is taken).

Auth is `Authorization: Bearer <accessToken>` unless a route says otherwise.
Errors are always `{ "error": { "code": "...", "message": "..." } }`.

Mounted in `backend/src/routes/index.js`. Note that `/events` is served by
three routers stacked on the same prefix: `events`, `registrations`, `media`.

## Health

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | none |

Returns `{ status: "ok", timestamp }`.

## Auth (`auth.routes.js`)

All the `authLimiter` routes are capped at 30 requests / 15 min / IP
(`429 TOO_MANY_ATTEMPTS`; the counter is in memory, so a restart clears it).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | Attendee account |
| POST | `/auth/login` | none | Public realm |
| POST | `/auth/admin/login` | none | Admin realm |
| GET | `/auth/admin/exists` | none | `{ exists }` — closes `/maamul/signup` once true |
| POST | `/auth/admin/signup` | none | First admin only |
| POST | `/auth/photographer/login` | none | Photographer realm |
| POST | `/auth/refresh` | none | Body `{ refreshToken }`; rotates it |
| POST | `/auth/logout` | none | Body `{ refreshToken }`; deletes it server-side |
| POST | `/auth/signup/request` | none | Sends the email OTP |
| POST | `/auth/signup/verify` | none | Creates the user — not before |
| POST | `/auth/signup/cancel` | none | Drops the pending OTP |
| POST | `/auth/password/request-otp` | yes | In-session password change |
| POST | `/auth/password/change` | yes | Body includes the OTP |
| POST | `/auth/forgot-password/request` | none | |
| POST | `/auth/forgot-password/verify` | none | |

Tokens: access is a short-lived JWT (`JWT_SECRET`); refresh is long-lived
(`JWT_REFRESH_SECRET`), rotated on every refresh and stored in
`user.refreshTokens`, so a logged-out or rotated token stops working.

## Users — self service (`users.routes.js`)

| Method | Path | Auth |
|---|---|---|
| GET | `/users/me` | yes |
| PATCH | `/users/me` | yes |
| GET | `/users/me/registrations` | yes |
| POST | `/users/me/avatar` | yes (multipart `file`) |
| DELETE | `/users/me/avatar` | yes |

## Events — public (`events.routes.js`)

| Method | Path | Auth |
|---|---|---|
| GET | `/events/public` | none |
| GET | `/events/:eventId` | none |

`public` returns published, public events sorted by `startDateTime` ascending.

## Registration & check-in (`registrations.routes.js`)

| Method | Path | Auth |
|---|---|---|
| POST | `/events/:eventId/register` | attendee |
| GET | `/events/:eventId/registration/me` | attendee |
| POST | `/events/:eventId/checkin` | admin or photographer |
| GET | `/events/:eventId/gallery` | attendee |

**Register** — body `{ planId?, paymentReference? }` (`planId` required for
premium events). Returns `201 { registration }`, or the existing one if
already registered.

| Code | When |
|---|---|
| `403 REGISTRATION_CLOSED` | Event is draft or completed, or unpublished |
| `403 PROFILE_INCOMPLETE` | Also returns `missingProfileFields[]` |
| `400 VALIDATION_ERROR` | Premium event, missing or unknown `planId` |

**Check-in** — body `{ registrationCode }` or `{ qrToken }`. Rate limited.
Returns `{ registration, guest: { fullName, email } }`.

| Code | When |
|---|---|
| `403 CHECKIN_CLOSED` | `checkInOpen` is false |
| `403 PAYMENT_REQUIRED` | Premium event, payment not confirmed |
| `404 NOT_REGISTERED` | No registration for that code |
| `409 ALREADY_CHECKED_IN` | Code already spent — includes `registration` and `guest` |

**Gallery** — the gate. `403 NOT_REGISTERED`, then `403 NOT_ATTENDED`, then
`200 { media: [...] }` newest first.

## Media (`media.routes.js`, mounted on `/events`)

| Method | Path | Auth |
|---|---|---|
| POST | `/events/:eventId/media` | admin, or assigned photographer (multipart `file`, optional `caption`) |
| GET | `/events/:eventId/media` | admin or photographer — management view |
| DELETE | `/events/:eventId/media/:mediaId` | admin any; photographer own uploads only |

| Code | When |
|---|---|
| `403 NOT_ASSIGNED` | Photographer not on this event |
| `403 FORBIDDEN` | Photographer deleting someone else's upload |
| `503 MEDIA_STORAGE_UNCONFIGURED` | `MEDIA_STORAGE=cloudinary` with no credentials |

## Admin — events (`admin.events.routes.js`)

Admin-only except the list, which photographers may read to find their events.

| Method | Path | Role |
|---|---|---|
| GET | `/admin/events` | admin, photographer |
| POST | `/admin/events` | admin |
| GET | `/admin/events/photographers` | admin |
| GET | `/admin/events/trash` | admin |
| PATCH | `/admin/events/:eventId` | admin |
| PATCH | `/admin/events/:eventId/restore` | admin |
| DELETE | `/admin/events/:eventId` | admin — moves it to the trash |
| DELETE | `/admin/events/:eventId/permanent` | admin |
| POST | `/admin/events/:eventId/cover` | admin (multipart `file`) |
| PUT | `/admin/events/:eventId/photographers` | admin |
| PATCH | `/admin/events/:eventId/checkin-open` | admin |
| GET | `/admin/events/:eventId/registrations` | admin |
| PATCH | `/admin/events/:eventId/registrations/:registrationId/payment` | admin |

Create requires `title`, `startDateTime`, `endDateTime`; defaults are
`visibility=public`, `published=true`, `status=draft`, `checkInOpen=false`.
`isPremium` is only honoured at creation.

### Trashing and restoring an event

`DELETE /admin/events/:eventId` does not destroy anything. It sets `deletedAt`,
after which the event is hidden by every read in the app - the public list, the
details page, registration, check-in, the gallery, the admin table and the
photographer console - while its media files, media rows and registrations stay
untouched in the database. Trashing an event already in the trash is `409
ALREADY_TRASHED`.

`GET /admin/events/trash` lists what can still be brought back, each row carrying
`mediaCount`, `registrationCount`, `autoDeleteAt` and `daysLeft`, plus
`autoPurged` for anything this visit swept out. `PATCH /admin/events/:eventId/restore`
puts the event back exactly as it was and `409 NOT_IN_TRASH` if it was not in the
trash. `DELETE /admin/events/:eventId/permanent` is the only route that destroys
data; it removes the event, its media files, its media rows and its registrations,
and works whether or not the event was trashed first.

An event leaves the trash on its own after 30 days (`TRASH_RETENTION_DAYS`). That
sweep runs when the trash is listed rather than from a scheduler, so nothing
expires unseen and the app still needs no cron.

## Admin — users (`admin.users.routes.js`)

Whole router is `requireAuth, requireRole("admin")`.

| Method | Path |
|---|---|
| GET | `/admin/users` |
| POST | `/admin/users` |
| GET | `/admin/users/:userId` |
| PATCH | `/admin/users/:userId` |
| PATCH | `/admin/users/:userId/password` |
| PATCH | `/admin/users/:userId/status` |
| DELETE | `/admin/users/:userId` |

This is the only way a photographer account comes into existence.

## Contact & messages

| Method | Path | Auth |
|---|---|---|
| POST | `/contact` | none (`contactLimiter`) |
| GET | `/admin/messages` | admin |
| POST | `/admin/messages/:messageId/reply` | admin |

## Admin — activity

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/activity` | admin |

## Photographer

| Method | Path | Auth |
|---|---|---|
| GET | `/photographer/dashboard` | photographer |

Rolls up the photographer's own uploads: totals by type, per-assigned-event
counts with last-upload time, and the 8 most recent uploads.

## Static media

When `MEDIA_STORAGE=local`, files are served read-only from `/uploads`
(not under `/api`). Filenames are 32 random hex characters — unguessable, but
not individually access-controlled.
