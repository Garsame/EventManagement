# Runbook
1. Install Node.js 18+ and ensure MongoDB is running locally.
2. Copy `backend/.env.example` to `backend/.env` and adjust values if needed.
3. Start backend: `cd backend && npm install && npm run dev`.
4. Start frontend: `cd frontend && npm install && npm run dev`.
5. Verify health at http://localhost:5000/api/health and UI at http://localhost:5173.

## Troubleshooting
- Port in use: change `PORT` or `CORS_ORIGIN` in `.env`.
- Mongo unreachable: confirm `mongod` service is running and `MONGO_URI` matches.

## Environment Variables
- `PORT` (default 5000)
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (e.g., 15m)
- `REFRESH_TOKEN_EXPIRES_IN` (e.g., 7d)
- `CORS_ORIGIN` (default http://localhost:5173)

## Seeding an Admin
Run once after setting `.env`:
```
cd backend
npm run seed
```
Creates admin user `admin@example.com` with password `Admin123!`.

## Quick Auth Test
1) Register: `curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"fullName":"Test User","email":"test@example.com","password":"Secret123"}'`
2) Login: `curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Secret123"}'`
3) Refresh: `curl -X POST http://localhost:5000/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<refresh>"}'`
4) Logout: `curl -X POST http://localhost:5000/api/auth/logout -H "Content-Type: application/json" -d '{"refreshToken":"<refresh>"}'`

## Events Module Tests (admin token required)
1) Login as admin (after seeding) to get `accessToken`:  
`ACCESS=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"Admin123!"}' | jq -r '.accessToken')`
2) Create event:  
`curl -X POST http://localhost:5000/api/admin/events -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" -d '{"title":"Launch Party","startDateTime":"2026-03-01T18:00:00Z","endDateTime":"2026-03-01T21:00:00Z","location":"Main Hall","visibility":"public","published":true}'`
3) List public events: `curl http://localhost:5000/api/events/public`
4) Fetch details: `curl http://localhost:5000/api/events/<eventId>`

## Registration & Check-in Flow
1) Register as attendee (auth required):  
`curl -X POST http://localhost:5000/api/events/<eventId>/register -H "Authorization: Bearer <attendeeAccess>" -H "Content-Type: application/json"`
2) Check registration status:  
`curl http://localhost:5000/api/events/<eventId>/registration/me -H "Authorization: Bearer <attendeeAccess>"`
3) Admin/photographer check-in attendee using code or token:  
`curl -X POST http://localhost:5000/api/events/<eventId>/checkin -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" -d '{"registrationCode":"EVT-XXXX"}'`
4) Gallery gate (only after attended=true):  
`curl http://localhost:5000/api/events/<eventId>/gallery -H "Authorization: Bearer <attendeeAccess>"`
