# Architecture

Two processes, one database.

```
frontend (Vite :5173)  --HTTP/JSON-->  backend (Express :5099)  -->  MongoDB :27017
       |                                        |
       +-------- <img src=".../uploads/..."> ---+   (static files, local driver)
```

## Backend — `backend/src`

```
server.js            boot: loadEnv -> connectDB -> app.listen
app.js               helmet, CORS, json, /uploads static, /api routes, errorHandler
routes/index.js      mounts every router under /api
routes/*.routes.js   paths + guards only
controllers/*.js     all the logic (2,300 lines)
models/*.js          7 Mongoose schemas + their DTO helpers
middleware/          auth.js (JWT), role.js, upload.js (multer), rateLimit.js, errorHandler.js
config/              db.js, storage.js, cloudinary.js, mailer.js
utils/               token.js, activityLog.js, seed.js, constants.js, migrateStatus.js
```

The layering is strict: **routes declare guards, controllers hold logic,
models own the data rules.** Business rules that must not be bypassed live on
the model as exported predicates — `canRegisterFor`, `canManageEventMedia`,
`missingProfileFields` — so every caller enforces them the same way.

Three routers share the `/api/events` prefix: `events` (public reads),
`registrations` (register / check-in / gallery), and `media` (management).

## Frontend — `frontend/src`

```
main.jsx             providers: Theme, Auth, AdminAuth, PhotographerAuth
routes/AppRouter.jsx every route in the app, grouped by realm
pages/               18 public/attendee + 10 admin + 4 photographer
components/          shared UI; ui/ is the primitive set (Button, Card, Modal, ...)
components/layout/   Public, Dashboard, AdminConsole, PhotographerConsole shells
context/             one auth context per realm, all built by createRealmAuth
api/                 client.js (public), realm.js (realm factory), tokenStore.js
styles/global.css    the design system — hand-rolled Tailwind utility classes
```

**No chart library is installed.** Dashboard visuals are plain CSS bars
(`.progress-track` / `.progress-fill`). Keep it that way rather than adding a
dependency.

## Auth

- **Tokens**: short-lived access JWT + long-lived refresh JWT. The refresh
  token is rotated on every use and stored in `user.refreshTokens`, so logout
  and rotation both genuinely invalidate.
- **Transparent refresh**: both axios clients retry a `401` once after
  refreshing, de-duplicating concurrent refreshes behind a single promise.
- **Three realms**: `api/realm.js` builds an isolated `{ tokenStore, client }`
  per realm with its own `localStorage` keys, so `/maamul` in one tab and the
  public site in another never collide. `ProtectedRoute` guards the public
  realm; `RealmProtectedRoute` guards the other two.

## Storage

Pluggable behind one driver interface in `config/storage.js`.

- `MEDIA_STORAGE=local` (default) — writes to `backend/uploads`, served
  read-only as static files. No third-party account needed, which matters
  because Cloudinary is not available in every country.
- `MEDIA_STORAGE=cloudinary` — same interface, no code changes; just add the
  three credentials.

Access to the *gallery listing* is authorised by the check-in gate. The file
URLs themselves are unguessable (32 random hex characters) but not
individually signed — the same property the Cloudinary URLs had. Signed or
proxied file access is the next step if stricter control is needed.
`resolveInsideUploads()` blocks path traversal when deleting by `publicId`.

## Cross-origin

The frontend (5173) calls the API and loads media from a different origin
(5099), so `helmet` runs with `crossOriginResourcePolicy: "cross-origin"` and
CORS is pinned to `CORS_ORIGIN`. `PUBLIC_BASE_URL` must match the port the
backend actually binds, or uploaded images 404 in the browser.

## Tests

- Backend: `npm test` — 93 tests, `node --test`, runs against a separate
  `event_media_test` database and drops it afterwards.
- Frontend: `npm test` — 11 tests, vitest + Testing Library.
