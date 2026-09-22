# autopartdz — Document Management Platform

Internal platform for managing car-import document workflows (COC, CO, CI, GREENBOOK, etc.) for Algerian car importers. Tracks documents from client request through China-side sourcing/local production to final delivery.

---

## Prerequisites

- **Node.js** v18+ (tested on v20 LTS)
- **MongoDB** running locally on the default port (`mongodb://localhost:27017`)
- **npm** v9+

---

## Project Structure

```
autopartdz/
├── server/          Express + Node backend
│   ├── src/
│   │   ├── models/        Mongoose schemas
│   │   ├── middleware/     auth + file-size middleware
│   │   ├── routes/        API route handlers
│   │   ├── app.js         Express app setup
│   │   └── server.js      Entry point
│   ├── scripts/
│   │   └── seedAdmin.js   Bootstrap first admin account
│   ├── .env.example
│   └── package.json
└── client/          Vite + React frontend
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.css
    │   └── main.jsx
    ├── .env.example
    └── package.json
```

---

## Setup

### 1. Clone and install dependencies

```bash
# Install server deps
cd server
npm install

# Install client deps
cd ../client
npm install
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string (default: `mongodb://localhost:27017/autopartdz`) |
| `JWT_SECRET` | Long, random secret for signing JWTs — **change this** |
| `PORT` | Port for the Express API (default: `5000`) |
| `SEED_ADMIN_EMAIL` | Email for the bootstrap admin account |
| `SEED_ADMIN_PASSWORD` | Password for the bootstrap admin (min 8 chars) |
| `SEED_ADMIN_NAME` | Display name for the bootstrap admin |

### 3. Configure the client (optional)

```bash
cd client
cp .env.example .env
```

The default API URL is `http://localhost:5000/api`. Change `VITE_API_URL` if your server runs on a different port.

---

## Running the App

### Create the first admin account (one-time setup)

```bash
cd server
npm run seed:admin
```

This creates a single admin account from your `.env` values (or interactively if env vars are not set). It is **idempotent** — running it again when the email already exists does nothing.

### Start the backend

```bash
cd server
npm run dev      # development mode with nodemon auto-restart
# or
npm start        # production mode
```

The API will be available at `http://localhost:5000`.

### Start the frontend

```bash
cd client
npm run dev
```

The React app will be available at `http://localhost:5173`.

---

## API Overview (Phase 1)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Server + MongoDB health check |
| `POST` | `/api/auth/login` | Public | Login (admin / china_associate) |
| `GET` | `/api/auth/me` | JWT | Current user's profile |
| `POST` | `/api/users` | Admin | Create a new user |
| `GET` | `/api/users` | Admin | List all users |
| `PATCH` | `/api/users/:id` | Admin | Update user (name, email, active, role) |

---

## Verifying the Stack

1. Start MongoDB, then start the server — check `GET /api/health` returns `{ "status": "ok", "mongo": "connected" }`.
2. Run `npm run seed:admin`, then log in via the React app at `http://localhost:5173`.
3. On successful login the page shows your name, email, and role.

---

## Development Notes

- Files (document scans etc.) are stored as binary directly in MongoDB — no external object storage. A **12 MB hard limit** per file is enforced at the API layer.
- Tracking codes for orders are **random alphanumeric** (not sequential) — sequential codes are guessable.
- There is **no public registration route**. All accounts are created by an admin via `POST /api/users` or the seed script.
- Clients never log in. Client-facing status lookup (planned for a later phase) returns status text only — never files or pricing.
