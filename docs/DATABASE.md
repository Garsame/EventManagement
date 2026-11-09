# Database

MongoDB via Mongoose. Seven collections, all defined in
`backend/src/models/`.

## users (`User.js`)

Identity plus the attendee profile, in one document.

- **Identity**: `fullName`, `email` (unique, lowercased), `passwordHash`,
  `role` (`admin` | `photographer` | `attendee`), `isActive`, `createdBy`,
  `lastLoginAt`, `createdAt`
- **Profile**: `phone`, `location`, `institution`, `educationLevel`
  (enum: high-school, certificate, diploma, bachelors, masters, doctorate,
  other), `fieldOfStudy`, `sex` (female | male | prefer-not-to-say),
  `dateOfBirth`, `bio` (max 500), `avatarUrl`, `avatarPublicId`
- **Sessions**: `refreshTokens[]` — active refresh tokens, for rotation and
  server-side invalidation on logout

Helpers: `REQUIRED_PROFILE_FIELDS`, `missingProfileFields()`,
`isProfileComplete()`, and `toUserDTO()` — the only shape sent to a client.
It derives `firstName`/`lastName`/`initials` and never includes
`passwordHash` or `refreshTokens`.

## events (`Event.js`)

- **Basics**: `title`, `description`, `location`, `startDateTime`,
  `endDateTime`, `createdBy`, `createdAt`
- **Visibility**: `visibility` (public | private), `published`
- **Lifecycle**: `status` (draft | registration-open | completed) —
  independent of `checkInOpen`, the day-of switch that opens the door
- **Cover**: `coverImageUrl`, `coverImagePublicId`
- **Premium**: `isPremium` (set at creation only), `currency`,
  `plans[]` = `{ name, price, description }` — each plan gets its own `_id`
- **Staffing**: `photographers[]` — only these users, plus admins, may upload
  or delete this event's media
- **Trash**: `deletedAt` (null when live) — set instead of deleting the row, so
  the event's media and registrations survive and it can be restored

Helpers: `canRegisterFor(event)` (published **and** registration-open),
`canManageEventMedia(event, user)` (admin always; photographer only if
assigned), `trashExpiryFor(deletedAt)` and `TRASH_RETENTION_DAYS` (30).

A `pre(/^find/)` hook adds `deletedAt: null` to every read unless the query
already filters on `deletedAt` or passes `includeDeleted: true`. Events are read
from about twenty places across five controllers, so hiding the trashed ones at
the schema is what makes it impossible to forget in one of them; opting out is
only how the trash list and the seed's duplicate check work.

## eventregistrations (`EventRegistration.js`)

One row per guest per event.

- `eventId`, `userId`, `registeredAt`
- `registrationCode` (`EVT-XXXXXX`), `qrToken` (64 hex chars)
- `attended`, `checkedInAt`, `checkedInBy`
- **Premium snapshot** (only on premium events): `planId`, `planName`,
  `amountDue`, `currency` — copied at registration, never looked up live, so
  editing the event's plans afterwards cannot change what a guest already
  committed to
- **Payment**: `paymentStatus` (pending | paid | refunded), `paymentMethod`
  (`"manual"` today), `paymentReference`, `paymentConfirmedAt`,
  `paymentConfirmedBy`

Indexes: unique `(eventId, userId)`, plus `registrationCode` and `qrToken`.

## media (`Media.js`)

- `eventId`, `uploadedBy`, `type` (image | video)
- `url`, `thumbnailUrl`, `publicId`, `caption`, `width`, `height`, `createdAt`

`publicId` is what the storage driver uses to delete the underlying file —
`"<eventId>/<32-hex>.<ext>"` locally, or the Cloudinary public id.
Index: `(eventId, createdAt desc)`.

## otps (`Otp.js`)

- `email`, `purpose` (signup | password-reset), `codeHash`, `attempts`,
  `expiresAt`, `createdAt`
- `payload` — for signup, holds the pending account (`fullName`,
  `passwordHash`) so **no `users` row exists until the code is verified**

Only the SHA-256 hash of the code is stored. TTL index on `expiresAt` lets
Mongo delete expired codes, so a stale code cannot be reused.
`OTP_TTL_MINUTES = 10`, `MAX_ATTEMPTS = 5`, constant-time comparison.

## messages (`Message.js`)

Contact-form submissions.

- `name`, `email`, `subject`, `body`, `status` (open | replied), `createdAt`
- `reply` = `{ body, repliedAt, repliedBy }`

Index: `(status, createdAt desc)`. DTO: `toMessageDTO()`.

## activitylogs (`ActivityLog.js`)

The admin audit trail.

- **Actor, denormalised**: `actorId`, `actorLabel`, `actorRole` — stored as
  text so the log still reads correctly after the account is edited or deleted
- `action` (e.g. `registration.checked_in`, `media.uploaded`,
  `media.deleted`), `summary`
- **Target**: `targetType`, `targetId`, `targetLabel`
- `createdAt`

Indexes: `createdAt desc`, and `(action, createdAt desc)`.
Written through `utils/activityLog.js`. DTO: `toActivityDTO()`.
