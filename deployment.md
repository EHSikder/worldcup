# World Cup 2026 Predictor — Deployment Guide

Complete step-by-step deployment instructions for the WC2026 Knockout Prediction Web Application.

---

## Architecture Overview

| Component | Service | URL |
|-----------|---------|-----|
| Frontend | Vercel | `https://your-domain.vercel.app` |
| Backend API | Render | `https://your-api.onrender.com` |
| Database | Supabase | `https://your-project.supabase.co` |
| Live Data | API-Football v3 | `https://v3.football.api-sports.io` |

---

## 1. Supabase Setup

### 1.1 Create Project
1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose your organization
4. Set project name: `wc2026-predictor`
5. Set a strong database password (save this — you will need it)
6. Choose the region closest to your users
7. Click **Create new project** and wait for provisioning (~2 minutes)

### 1.2 Run the Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open the `schema.sql` file from this project
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. Verify all tables were created by checking the **Table Editor** tab

You should see these tables:
- `teams` (48 rows)
- `matches` (32 rows — knockout matches 73-104)
- `users` (empty)
- `predictions` (empty)
- `bracket_locks` (6 rows — one per knockout round)
- `admin_users` (1 row — default admin)
- `scoring_rules` (6 rows)
- `champion_predictions` (empty)
- `sync_log` (empty)

### 1.3 Get Connection Variables
1. Go to **Settings** → **API** in Supabase dashboard
2. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY` (frontend)
   - **service_role secret key** → `SUPABASE_SERVICE_KEY` (backend only — NEVER expose this in frontend)

### 1.4 Change Default Admin Password
> **IMPORTANT:** The default admin password is `admin2026!`. Change it immediately.

Run this in the Supabase SQL Editor:
```sql
UPDATE admin_users 
SET password_hash = crypt('YOUR_NEW_SECURE_PASSWORD', gen_salt('bf', 10)) 
WHERE username = 'admin';
```

---

## 2. API-Football Setup

### 2.1 Get API Key
1. Go to [https://www.api-football.com](https://www.api-football.com)
2. Sign up for an account
3. Subscribe to a plan:
   - **Free plan**: 100 requests/day (sufficient for development)
   - **Pro plan**: 7,500 requests/day (recommended for production — the 20-min cron job uses ~72 requests/day)
4. Go to your dashboard and copy the **API Key**
5. This will be set as `API_FOOTBALL_KEY` environment variable

### 2.2 Verify Access
Test that your key works:
```bash
curl -H "x-apisports-key: YOUR_API_KEY" \
  "https://v3.football.api-sports.io/leagues?id=1&season=2026"
```

You should receive a JSON response with World Cup league data.

---

## 3. Twilio Setup (for OTP SMS)

> **Note:** If you don't want to use Twilio, set `MOCK_OTP=true` in your backend environment. This will log OTP codes to the console and accept `123456` as a valid OTP for any number.

### 3.1 Create Twilio Account
1. Go to [https://www.twilio.com](https://www.twilio.com) and sign up
2. Verify your email and phone number
3. From the Twilio Console, copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
4. Buy a phone number with SMS capability → `TWILIO_PHONE_NUMBER` (format: `+1234567890`)

---

## 4. Backend Deployment (Render)

### 4.1 Push Code to Git
1. Create a GitHub/GitLab repository
2. Push the `backend/` directory to the repo

### 4.2 Create Render Web Service
1. Go to [https://render.com](https://render.com) and sign in
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `wc2026-api`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Instance Type**: Starter ($7/month) or higher

### 4.3 Set Environment Variables
In Render dashboard → **Environment** tab, add:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `your-service-role-key` |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `ADMIN_JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `API_FOOTBALL_KEY` | Your API-Football key |
| `FRONTEND_URL` | `https://your-domain.vercel.app` |
| `TWILIO_ACCOUNT_SID` | Your Twilio SID (or leave empty) |
| `TWILIO_AUTH_TOKEN` | Your Twilio token (or leave empty) |
| `TWILIO_PHONE_NUMBER` | Your Twilio number (or leave empty) |
| `MOCK_OTP` | `false` (set `true` for dev/testing) |

### 4.4 Deploy
1. Click **Create Web Service**
2. Render will build and deploy automatically
3. Note the URL: `https://wc2026-api.onrender.com`

### 4.5 Verify Backend
```bash
curl https://wc2026-api.onrender.com/api/health
# Should return: { "status": "ok", "timestamp": "..." }

curl https://wc2026-api.onrender.com/api/teams
# Should return all 48 teams
```

---

## 5. Frontend Deployment (Vercel)

### 5.1 Push Code to Git
1. Push the `frontend/` directory to a GitHub repo (can be the same repo as backend, or separate)

### 5.2 Create Vercel Project
1. Go to [https://vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend` (if monorepo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (auto-detected)

### 5.3 Set Environment Variables
In Vercel dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://wc2026-api.onrender.com` |

### 5.4 Deploy
1. Click **Deploy**
2. Vercel will build and deploy automatically
3. Note the URL: `https://your-domain.vercel.app`

### 5.5 Update Backend CORS
After getting your Vercel URL, update the `FRONTEND_URL` environment variable on Render to match your Vercel URL. Redeploy the backend.

---

## 6. Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `predict.worldcup2026.com`)
3. Follow DNS instructions to add CNAME record

### Render (Backend)
1. Go to Render service → **Settings** → **Custom Domain**
2. Add subdomain (e.g., `api.worldcup2026.com`)
3. Follow DNS instructions

After setting custom domains, update:
- `NEXT_PUBLIC_API_URL` in Vercel to point to your API domain
- `FRONTEND_URL` in Render to point to your frontend domain

---

## 7. Post-Deployment Checklist

- [ ] Schema runs successfully in Supabase
- [ ] All 48 teams visible in Teams table
- [ ] All 32 knockout matches visible in Matches table
- [ ] Admin login works at `/admin-6788157` with updated password
- [ ] User registration flow works (register → OTP → verify)
- [ ] Bracket prediction UI loads with all rounds
- [ ] Predictions can be submitted and saved
- [ ] Leaderboard page loads
- [ ] API-Football cron job runs every 20 minutes (check Render logs)
- [ ] Sync log entries appear in Supabase `sync_log` table
- [ ] Admin can lock/unlock rounds
- [ ] Locked rounds prevent prediction edits
- [ ] Export functionality works (XLSX/CSV download)
- [ ] Mobile responsive layout works on actual devices
- [ ] CORS is properly configured (no cross-origin errors)
- [ ] HTTPS is active on all endpoints

---

## 8. API-Football Cron Job

The cron job is built into the backend Express server and runs automatically every 20 minutes using `node-cron`. It:

1. Fetches latest World Cup 2026 fixtures from API-Football
2. Updates match scores and statuses in Supabase
3. Auto-locks predictions for completed matches
4. Calculates and awards points
5. Advances winners through the bracket
6. Logs results to the `sync_log` table

**Monitoring:**
- Check Render logs for cron output
- Check `/api/admin/sync-status` endpoint
- Check `sync_log` table in Supabase

**Manual Trigger:**
- Admin panel → Bracket Control → "Trigger Sync" button
- Or: `POST /api/admin/trigger-sync` with admin JWT

---

## 9. Troubleshooting

### Common Issues

**CORS Errors:**
- Ensure `FRONTEND_URL` in Render matches your exact Vercel URL (including `https://`)
- Check that no trailing slash is included

**OTP Not Received:**
- Check Twilio dashboard for delivery status
- Ensure phone number format includes country code (e.g., `+1234567890`)
- Try `MOCK_OTP=true` for testing

**API-Football Returning Empty Data:**
- World Cup 2026 data may not be available until closer to tournament
- Check rate limits: free plan allows 100 requests/day
- Verify API key with a direct curl request

**Supabase RLS Blocking Requests:**
- Backend uses `service_role` key which bypasses RLS
- If using Supabase client directly from frontend, ensure proper auth headers

**Render Free Tier Cold Starts:**
- Free tier services spin down after inactivity
- First request may take 30-60 seconds
- Upgrade to Starter ($7/month) for always-on

---

## 10. Environment Variables Summary

### Backend (Render)
```env
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...your-service-role-key
JWT_SECRET=your-random-64-char-hex-string
ADMIN_JWT_SECRET=your-other-random-64-char-hex-string
API_FOOTBALL_KEY=your-api-football-key
FRONTEND_URL=https://your-domain.vercel.app
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
MOCK_OTP=false
```

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```
