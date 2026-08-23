# Requirements

The settled requirements for the Event Media Sharing & Management System.
Anything listed under "Built" is implemented and covered by the test suite.

## 1. The core rule

**Event media is private to the people who actually showed up.**

A guest sees an event's photos and videos only after passing three gates in
order:

```
registered  ->  checked in at the door  ->  gallery unlocked
```

Registering alone is not enough. Being on the guest list is not enough. The
gate is enforced in the API (`GET /api/events/:eventId/gallery`), not only in
the UI:

| Situation | Response |
|---|---|
| Not registered | `403 NOT_REGISTERED` |
| Registered, not checked in | `403 NOT_ATTENDED` |
| Registered and checked in | `200 { media: [...] }` |

Public event *listings* stay open to everyone. Only the media is gated.

## 2. Roles

Three roles, one `role` field on `users`: `admin`, `photographer`, `attendee`.

| Role | Gets an account by | Can |
|---|---|---|
| `attendee` | Self sign-up with email OTP | Browse events, register, show a QR code, view galleries of events they attended |
| `photographer` | Created by an admin only | Upload/delete media for events an admin assigned them to, run check-in |
| `admin` | First admin self-signs up; after that, admin-created only | Everything: events, users, check-in, media, payments, messages, reports |

There is no self sign-up for photographers, and no second admin sign-up —
`GET /api/auth/admin/exists` closes `/maamul/signup` once one exists.

## 3. Three separate auth realms

Each realm has its own login route, its own axios client, and its own
`localStorage` keys, so a session in one is invisible to the others.

| Realm | Login | Console | Storage prefix |
|---|---|---|---|
| Public / attendee | `/login` | `/dashboard/*` | `ems_public_*` |
| Admin | `/maamul/login` | `/maamul/*` | `ems_admin_*` |
| Photographer | `/photographer/login` | `/photographer/*` | `ems_photographer_*` |

`/maamul` is deliberately unguessable rather than `/admin`. Realm isolation
lives in `frontend/src/api/realm.js`.

## 4. Event lifecycle

`status` and `checkInOpen` are separate on purpose — the guest list and the
door are two different switches.

| Field | Values | Controls |
|---|---|---|
| `status` | `draft` -> `registration-open` -> `completed` | Whether new registrations are accepted |
| `published` | boolean | Whether the event appears publicly |
| `visibility` | `public` / `private` | Listing scope |
| `checkInOpen` | boolean | Whether the door is open for scanning today |

- Registration is refused unless `published === true && status === "registration-open"` (`403 REGISTRATION_CLOSED`).
- Check-in is refused unless `checkInOpen === true` (`403 CHECKIN_CLOSED`).

## 5. Profile completeness gate

A guest cannot take a place until the organiser has what they need on file.
Required: **phone, location, institution, educationLevel, sex**. Field of
study is optional — it does not apply to everyone.

Enforced server-side as `403 PROFILE_INCOMPLETE`, with the missing field names
returned so the UI can point at them.

## 6. Check-in

- Every registration gets a `registrationCode` (`EVT-XXXXXX`) and a 64-char
  `qrToken`.
- Staff scan the QR (`html5-qrcode`) or type the code at `/maamul/checkin`.
- **A code is spent once.** Re-scanning an already-checked-in guest returns
  `409 ALREADY_CHECKED_IN` rather than silently succeeding, so the desk can
  never wave the same person through twice unnoticed.
- The response carries the guest's name and email, so the desk sees who it
  just scanned.
- Rate limited (`checkInLimiter`) and written to the activity log.

## 7. Premium events

Some events charge for participation.

- `isPremium` is fixed at creation; `plans[]` (name, price, description) stay
  editable afterwards.
- On registering, the chosen plan is **snapshotted** onto the registration
  (`planName`, `amountDue`, `currency`). Editing or deleting a plan later
  never changes what someone already committed to.
- Payment is **manual today** — an admin confirms it in the console.
  `paymentMethod` defaults to `"manual"` so a future gateway can set its own
  value without a schema change.
- **A premium guest cannot be checked in until payment is confirmed**
  (`403 PAYMENT_REQUIRED`). This is where the fee is actually enforced.

## 8. Media

- Uploaded only by an admin, or a photographer **assigned to that event**
  (`403 NOT_ASSIGNED`).
- A photographer may delete only their own uploads; an admin may delete any.
- Storage is pluggable behind one driver interface (`config/storage.js`):
  `MEDIA_STORAGE=local` (default, writes to `backend/uploads`) or
  `cloudinary`. Local is the default because Cloudinary is not available in
  every country.
- Filenames are 32 random hex characters. URLs are unguessable but not
  individually signed — the same property the Cloudinary URLs had. Signed or
  proxied file access is the next step if stricter control is needed.

## 9. Security requirements

- Passwords: bcrypt, cost 10.
- Access token: short-lived JWT (`JWT_SECRET`). Refresh token: long-lived
  (`JWT_REFRESH_SECRET`), **rotated on every refresh** and stored server-side
  in `user.refreshTokens`, so logout genuinely invalidates.
- Email OTP for sign-up and password reset. Only the **hash** of the code is
  stored; codes expire in 10 minutes via a Mongo TTL index, cap at 5 attempts,
  and compare in constant time. No `users` row exists until sign-up is
  verified.
- Auth endpoints rate limited to 30 requests / 15 min / IP
  (`429 TOO_MANY_ATTEMPTS`).
- Deactivated accounts (`isActive: false`) keep their data but cannot sign in.
- `toUserDTO` never emits `passwordHash` or `refreshTokens`.
- `helmet` on; CORS locked to `CORS_ORIGIN`.
- Admin actions are written to `ActivityLog` with denormalised actor identity,
  so the log still reads correctly after the actor is edited or deleted.

## 10. Built

- Auth: register + email OTP, login, refresh with rotation, logout, forgot
  password, in-session password change with OTP.
- Three realms with separate consoles and guards.
- Public events list, event details, contact form.
- Attendee dashboard: overview, registrations with progress, profile editor,
  avatar upload.
- Registration -> QR -> check-in -> gallery, end to end.
- Admin console: overview, users (4 groups), events, premium events,
  registrations, check-in, media management, profile, messages, reports.
- Photographer console: dashboard with own upload stats, assigned events,
  per-event media management, profile.
- Media upload/delete with per-event assignment, batch uploads,
  hover-to-download in the gallery.
- Activity log and reports.
- Light/dark theme, applied before first paint (`ems_theme`).
- Tests: **93 backend** (`node --test`, own `event_media_test` DB) and
  **11 frontend** (vitest). All passing.

## 11. Not built yet

- Media URLs are unguessable but not signed or proxied per-request.
- Payment is manual confirmation only — no gateway integration.
- No pagination anywhere; fine at current volume.
- OTP email delivery depends on SMTP env vars being set.
- No soft-delete for events — deleting an event is permanent.
