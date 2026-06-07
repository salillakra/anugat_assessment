# Samayak Admin Panel

Samayak Admin Panel is a production-quality, full-stack university administration platform designed for modern academic management. It features **Automatic Timetable PDF Ingestion**, **Live Analytics Dashboards**, and full **CRUD configuration interfaces** for academic departments, rooms, courses, and faculty accounts.

---

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js 15      │────▶│  Hono / Bun      │────▶│  PostgreSQL      │
│  (App Router)    │     │  Express-style   │     │  (Prisma ORM)    │
│  Port 3000       │     │  Port 3001       │     │  Port 5432       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                 │
                                 ├──▶ Redis (BullMQ)
                                 │   Port 6379
                                 │
                                 └──▶ Worker Process
                                     (pdf-import, csv-import)
```

---

## Core Features

1. **PDF Timetable Ingestion Engine**:
   - Parses scan-transcribed and digital PDF timetables (supporting custom formats like BIT Mesra CSE-8).
   - Real-time import tracking utilizing **Socket.IO** to feed status directly to the browser.
   - Automatically executes entity resolution (creating missing departments, courses, rooms, and faculty members).

2. **Live Database Analytics**:
   - Computes **Room Utilisation Rate** (aggregate, per room, and per department).
   - Calculates **Empty Room Probability** across all teaching periods.
   - Flags **Under-Running Courses** (with active slots below their target thresholds).
   - Monitors **Average Daily Empty Hours** per room.
   - All analytics are computed live via optimized PostgreSQL queries (no mock caching).

3. **Robust CRUD & CSV Bulk Import**:
   - Configurable management screens for **Departments**, **Rooms**, **Courses**, and **Faculty**.
   - Bulk upload CSV capabilities with validation and per-row error tracking.

4. **Premium UX/UI**:
   - Sleek glassmorphic card design system.
   - Dark/Light mode support.
   - Interactive charts using **Recharts**.
   - Auto-filled Demo login helper for multiple roles (ADMIN, COORDINATOR, HOD, DEAN, FACULTY).

---

## Quick Start (Docker Compose)

The easiest way to run the entire stack is with Docker Compose. Ensure you have Docker and Docker Compose installed.

### 1. Configure Environment
Copy `.env.example` to `.env` inside the `backend` folder (or at the root for reference):
```bash
cp .env.example backend/.env
```

### 2. Spin Up Services
Run the following command at the project root to build and run all 5 services:
```bash
docker compose up --build
```
This command automatically:
- Spins up PostgreSQL and Redis.
- Builds and starts the Hono API server and BullMQ background worker.
- Builds and starts the Next.js frontend on `http://localhost:3000`.
- Executes Prisma DB migrations and seeds the demo database.

### 3. Access the Application
- **Frontend Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **Health check**: `http://localhost:3001/api/health`

---

## Local Development (Manual Setup)

If you prefer to run services individually for development:

### Prerequisites
- Install **Bun** (v1.1 or higher)
- Start local PostgreSQL (port 5432) and Redis (port 6379) servers.

### 1. Setup Backend
```bash
cd backend
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

### 2. Setup Frontend
```bash
cd frontend
bun install
bun run dev
```
The frontend dev server will launch on `http://localhost:3002` (or `3000` if available).

---

## Database Seed & Demo Accounts

The seed script creates the following demo credentials for testing:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@samayak.demo` | `demo123` |
| **Dean** | `dean@samayak.demo` | `demo123` |
| **HOD** | `hod@samayak.demo` | `demo123` |
| **Coordinator** | `coord@samayak.demo` | `demo123` |
| **Faculty** | `faculty@samayak.demo` | `demo123` |

Use the **"Use Demo Login"** buttons on the login screen to sign in instantly with any of these roles.

---

## Verification Plan

To verify the system pipeline:
1. Log in as **Admin** or **Coordinator**.
2. Navigate to **Imports** page.
3. Upload the target BIT Mesra timetable PDF (`CSE(8).pdf`).
4. Watch the progress bar advance in real-time. Upon completion, verify the slots are populated in the **Timetable Grid Viewer** and the analytics charts update on the **Dashboard**.
