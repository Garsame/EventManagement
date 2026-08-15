# Event Media Sharing & Management System

## Prerequisites
- Node.js 18+ and npm
- MongoDB running locally (mongodb://localhost:27017)

## Run Backend
```bash
cd backend
npm install
npm run dev
```
- Env file: copy `.env.example` to `.env`
- Health check: http://localhost:5000/api/health

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```
- App URL: http://localhost:5173

## Environment Variables
Defined in `backend/.env.example`:
- `PORT` (default 5000)
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `CORS_ORIGIN`
