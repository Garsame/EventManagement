# Architecture
- **Frontend**: React (Vite) SPA for attendee/admin flows.
- **Backend**: Node.js + Express REST API with JWT-based auth (placeholder for now).
- **Database**: MongoDB via Mongoose ODM.
- **Storage**: Pluggable media storage behind a single driver interface
  (`config/storage.js`). `MEDIA_STORAGE=local` (default) writes to
  `backend/uploads` and serves it as static files; `MEDIA_STORAGE=cloudinary`
  uses Cloudinary. Local is the default because Cloudinary is not available in
  every country. Access to the *gallery listing* is authorised by the check-in
  gate; the file URLs themselves are unguessable (32 random hex characters) but
  not individually signed — the same property the Cloudinary URLs had. Signed
  or proxied file access is the next step if stricter control is needed.
- **Communication**: HTTP/JSON between frontend and backend; CORS allows localhost dev.
