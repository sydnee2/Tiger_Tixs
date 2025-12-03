# ClemsonTicketingSystem (TigerTix)

TigerTix is a Clemson-themed full-stack ticket booking system with a voice-enabled LLM assistant. Users can search and book campus event tickets using natural language or speech.

- Live Demo: https://clemson-ticketing-system.vercel.app/

## Download
- GitHub: https://github.com/Nickflix21/ClemsonTicketingSystem

## Tech Stack
- Frontend: React, React Router, Web Speech API

- Backend: Node.js, Express (microservices)

- Database: SQLite3

- LLM Integration: Ollama + Llama 3

- CI/CD: GitHub Actions

- Hosting: Vercel (frontend), Railway/Render (backend)

- Testing: Jest, React Testing Library, Supertest

## Architecture Overview
TigerTix follows a microservices architecture with the following components:

- Frontend (React): User interface and voice interactions.

- Auth Service: Handles user authentication and JWT issuance.

- Client Service: Manages event listings and ticket purchases (SQLite).

- LLM Booking Service: Parses natural language requests for ticket bookings.

---

**Data Flow**
```
[ User (Browser) ]
        │
        v
[ Frontend (React) ]
        │
        ├── /api/auth → Auth Service
        │       ├── Receives registration/login requests
        │       ├── Issues JWT on successful login
        │       └── Returns auth status to frontend
        │
        ├── /api/events → Client Service
        │       ├── Fetches event listings
        │       ├── Sends ticket purchase requests
        │       └── Reads/writes to Shared SQLite DB
        │
        └── /api/llm/parse → LLM Booking Service
                ├── Receives natural language input (voice/text)
                ├── Parses intent and event details
                └── Sends booking request to Client Service

[ Shared SQLite Database ]
        ^
        └── Used by Admin Service and Client Service
                ├── Admin Service creates/updates events
                └── Client Service reads/writes bookings
```

## Features
- View events and available tickets.

- Register/login with the Auth microservice.

- LLM-driven booking confirmation using natural language commands.

- Voice-enabled conversational assistant for booking.

- CI/CD integration: auto-deploy frontend to Vercel, backend to Railway.

## Local Run Instructions

**Prerequisites:**

Make sure the following are installed on your system:

- **Node.js** (v18+)
- **npm** (v9+)
- **Ollama** (for local LLM inference)
  - [Install Ollama](https://ollama.ai/download)
- **SQLite3** (CLI tool, optional but useful for debugging)
- **Port availability**
  - `3000` → Frontend React app
  - `4000` → User authentication service
  - `6001` → Client service backend  
  - `6101` → LLM booking backend  
  - `11434` → Ollama model server (default Ollama port)

---

## LLM Setup (Ollama)

1. Make sure Ollama is running:
   ```bash
   ollama serve
   ```

2. Pull the Llama 3 model (or confirm it’s installed):
   ```bash
   ollama pull llama3
   ```

3. Verify the model is available:
   ```bash
   curl http://localhost:11434/api/tags
   ```

You should see:
```json
{"models":[{"name":"llama3:latest", ... }]}
```

---

## 1. Start the Client Service Backend

Handles event data and ticket purchases.

```bash
cd backend/client-service
npm install
npm start
```

Expected Output:
```
Using DB at: /path/to/backend/client-service/database.sqlite
Database initialized and ready.
Client service running on port 6001
```

Test it by visiting:  
[http://localhost:6001/api/events](http://localhost:6001/api/events)

You should see a list of events in JSON format.

---

## 2. Start the LLM-Driven Booking Backend

Parses natural language queries like “Book three tickets for Clemson Football Hate Watch.”

```bash
cd backend/llm-driven-booking
npm install
npm start
```

Expected Output:
```
llm-driven-booking running at http://localhost:6101
```

Test it manually:
```bash
curl http://localhost:6101/api/llm/parse   -X POST   -H "Content-Type: application/json"   -d '{"text":"Book two tickets for Clemson Homecoming"}'
```

You should receive JSON output like:
```json
{"intent":"propose_booking","event":"Clemson Homecoming","tickets":2}
```

---

## 3. Start the User Authentication Service

Handles user login and registration services.

```bash
cd backend/user-authentication
npm install
npm start
```

Expected Output:
```
User-auth service listening on 4000
```

---

## 4. Start the Frontend (React App)

Launches the voice-enabled web interface.

```bash
cd frontend
npm install
npm start
```

This will open the app at:
[http://localhost:3000](http://localhost:3000)

If port 3000 is already in use, React may ask to start on another port — choose **“No”** if possible, since the backend’s CORS allows only `http://localhost:3000` by default.  
If you must use another port, update CORS in `backend/client-service/server.js` accordingly.

---

## 5. Start the Database (SQLite3)

- SQLite file initialized via `backend/shared-db/init.sql` (services auto-create tables using SQLite3).

---

## Voice Assistant Demo

1. Click **Speak**.
2. Say a command such as:
   ```
   Book three tickets for Clemson Football Hate Watch
   ```
3. You’ll see:
   - Your spoken text appears in the chat window.
   - The LLM interprets the intent.
   - A confirmation prompt:
     > I found Clemson Football Hate Watch with 3 ticket(s). Would you like to confirm this booking?
4. Say “**yes**” to confirm — the purchase will be processed through the backend.

## Environment Variables

**Frontend (Vercel):**
- `REACT_APP_ADMIN_BASE` -> Admin service base URL (Render)
- `REACT_APP_CLIENT_BASE` -> Client service base URL (Render)
- `REACT_APP_AUTH_BASE` -> Auth service base URL (Render)
- `REACT_APP_LLM_BASE` -> LLM booking service base URL (Render)

**Backend services (Railway/Render):**
- `PORT` -> service port
- `JWT_SECRET` (auth + client-service)
- `DB_PATH` -> path to SQLite file (defaults to `./data.db` if supported)
- Any OpenAI keys for LLM booking if used: `OPENAI_API_KEY.`

## CI/CD (GitHub Actions)
- On push to `main`: installs deps, runs tests (frontend + all backend services).
- If tests pass: deploys frontend to Vercel and backend to Railway.

### Required Secrets (GitHub -> Repo Settings -> Secrets and variables -> Actions)
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `RAILWAY_TOKEN`

## Deployment Notes

### Vercel (Frontend)
1. Import repo in Vercel; set build: `npm run build`; output: `build`.
2. Set env vars listed above to your Render URLs.
3. First deployment creates project IDs; add them as GitHub secrets.

### Render (Backend)
1. Render auto-detects services via `render.yaml` and deploys from each `rootDir`.
2. In Render dashboard, set env vars:
  - `JWT_SECRET` (shared between `user-authentication` and `client-service`) – override the placeholder value.
  - `ALLOWED_ORIGIN` = `http://localhost:3000,https://clemson-ticketing-system.vercel.app/`
  - `COOKIE_SECURE=true` and `NODE_ENV=production` for `user-authentication`.
3. Verify health:
  - `https://client-service-kmaf.onrender.com/health`
  - `https://llm-driven-booking-kmaf.onrender.com/health`
  - `https://user-authentication-kmaf.onrender.com/health`
  - `https://admin-service-kmaf.onrender.com/api/admin/events`

## Feature Checklist
- Loads and displays events.
- Login/register via the Auth microservice.
- LLM-driven booking confirmation and voice interface.

## Testing
Run all tests locally:
```
# Frontend
cd frontend && npm test -- --watchAll=false

# Backend services
cd backend/admin-service && npm test -- --runInBand
cd backend/client-service && npm test -- --runInBand
cd backend/user-authentication && npm test -- --runInBand
```

## Directory Structure

```
ClemsonTicketingSystem/
├── backend/
│   ├── client-service/         # Express + SQLite backend for events
│   ├── user-authentication/    # Express backend for user authentication
│   └── llm-driven-booking/     # Express + Ollama LLM parser service
├── frontend/                   # React app with voice-enabled UI
└── README.md                   # You are here
```

## Common Issues

### “Failed to fetch.”
- Backend (`client-service`) isn’t running or CORS misconfiguration.
- Fix: Ensure this is at the top of `server.js`:
  ```js
  app.use(cors());
  app.use(express.json());
  ```

### “address already in use :::6001”
- Another process is using that port.
- Run:
  ```bash
  sudo lsof -i :6001 | awk 'NR>1 {print $2}' | xargs -r kill -9
  ```

### LLM returning “Unknown Event.”
- The LLM doesn’t recognize your event text.
- Fix: ensure your backend `parseController.js` sends event names from the database dynamically to the prompt.

### No sound/speech
- Chrome users: ensure microphone access is enabled.
- Firefox users: Web Speech API may need enabling in `about:config`.

---

## Shutdown Instructions

To stop all services cleanly:
```bash
# In each terminal
Ctrl + C
```

Optional cleanup:
```bash
sudo lsof -i :6001 :6101 :3000 | awk 'NR>1 {print $2}' | xargs -r kill -9
```

## Team
- Names: Nicholas Gagnon, Sydnee Richardson, Charlie Yocum
- Instructor: Dr. Julian Brinkley
- TA: Colt Doster

## License 
This project is licensed under the MIT license. See the LICENSE file for details.

---
