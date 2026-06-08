# Anugat AI — Samayak Admin Panel

Full-stack university timetable management and analytics platform. PDFs of timetables are uploaded, parsed by OCR + Gemini AI, integrated into a relational database, and visualised in a real-time Next.js dashboard.

---

## Project Structure

```
anugat_assessment/
├── frontend/          # Next.js 16 client 
└── backend/           # Hono/Bun API server
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser Client                      │
│  Next.js 16 · React 19 · Tailwind CSS v4 · Socket.IO   │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP REST + WebSocket
┌──────────────────────────▼──────────────────────────────┐
│                    Hono API Server (Bun)                  │
│  Routes → Controllers → Services → Prisma ORM            │
│  Auth (JWT cookie) · CORS · Correlation IDs              │
└───────┬──────────────────────────────────┬──────────────┘
        │  BullMQ job queues               │  Prisma Accelerate
┌───────▼───────────┐          ┌───────────▼──────────────┐
│   Redis (BullMQ)  │          │   PostgreSQL (PG)    │
│  noeviction policy│          │  via Prisma Accelerate    │
└───────┬───────────┘          └──────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────┐
│              PDF Import Pipeline (BullMQ Workers)        │
│                                                          │
│  PDF Upload → pdf2pic → Tesseract OCR (per page)        │
│            → OCR Aggregation → Gemini AI Parsing         │
│            → Zod Validation → ScannedTimetable (DB)      │
│            → [Integrate] → Timetable + TimetableSlot     │
└────────────────────────────────────────────────────────┘
```

---

## Backend

**Runtime:** Bun · **Framework:** Hono · **ORM:** Prisma 7 + Accelerate  
**Queue:** BullMQ 5 + Redis · **AI:** Google Gemini (`@google/genai`) · **Auth:** JOSE JWT

### Source Layout

```
backend/src/
├── index.ts                        # Server entry — Hono app + Socket.IO + workers
├── worker.ts                       # Standalone worker entry (optional)
│
├── config/
│   ├── db.ts                       # Prisma client singleton
│   ├── env.ts                      # Typed env vars (dotenv)
│   ├── gemini.ts                   # Google Gemini model config & enums
│   └── redis.ts                    # ioredis singleton + noeviction enforcement
│
├── controllers/
│   ├── analytics.controller.ts     # Room utilisation, under-running courses, KPIs
│   ├── auth.controller.ts          # Login, logout, /me
│   ├── branches.controller.ts      # CRUD for academic branches
│   ├── courses.controller.ts       # CRUD for courses (with faculty linking)
│   ├── departments.controller.ts   # CRUD for departments
│   ├── faculty.controller.ts       # CRUD for faculty users
│   ├── imports.controller.ts       # PDF upload, CSV import, job management, integrate
│   ├── rooms.controller.ts         # CRUD for rooms
│   └── timetables.controller.ts    # List, get, grid view for timetables
│
├── middleware/
│   ├── auth.middleware.ts          # JWT cookie + Bearer token verification
│   └── error.middleware.ts         # Global Hono error handler
│
├── queues/
│   ├── timetable-processing.queue.ts  # Main BullMQ queue + DLQ + flow producer
│   └── csv-import.queue.ts            # CSV import queue
│
├── routes/
│   ├── analytics.route.ts
│   ├── auth.route.ts
│   ├── branches.route.ts
│   ├── courses.route.ts
│   ├── departments.route.ts
│   ├── faculty.route.ts
│   ├── health.route.ts
│   ├── imports.route.ts            # PDF, CSV, job CRUD, retry, integrate
│   ├── rooms.route.ts
│   └── timetables.route.ts
│
├── services/
│   ├── analytics.service.ts        # Business logic for analytics queries
│   ├── auth.service.ts             # JWT sign/verify, user lookup
│   ├── csv-import.service.ts       # CSV → DB upsert for bulk entities
│   └── timetable-integration.service.ts  # ScannedTimetable → Timetable conversion
│
├── socket/
│   └── socket.ts                   # Socket.IO singleton with event buffering
│
├── types/
│   └── timetable-processing.types.ts  # Shared types for the import pipeline
│
├── utils/
│   ├── correlation.ts              # Correlation ID middleware
│   ├── image-processing.ts         # Sharp helpers for PDF page images
│   ├── logger.ts                   # Structured logger
│   └── response.ts                 # Typed JSON helpers (ok, notFound, paginatedOk…)
│
├── validators/
│   └── timetable.validator.ts      # Zod schema for Gemini output validation
│
└── workers/timetable/
    ├── index.ts                    # Worker factory — starts main + OCR workers
    ├── pdf-conversion.worker.ts    # pdf2pic: PDF → page images
    ├── ocr-page.worker.ts          # Tesseract.js OCR for a single page
    ├── ocr-aggregator.worker.ts    # Merge per-page OCR results
    ├── gemini-parsing.worker.ts    # Send OCR text + PDF image to Gemini
    ├── validation.worker.ts        # Zod validate Gemini JSON output; retry on fail
    └── database.worker.ts          # Persist validated data as ScannedTimetable
```

### Database Schema (Prisma)

| Model                  | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `User`                 | Faculty and admin accounts (role: ADMIN \| COORDINATOR \| HOD \| DEAN \| FACULTY) |
| `Department`           | Top-level academic department                                                     |
| `Branch`               | Programme/branch within a department                                              |
| `Room`                 | Physical room (CLASSROOM \| LAB \| SEMINAR \| OTHER)                              |
| `Course`               | Subject with credits, type (THEORY \| LAB \| TUTORIAL), semester                  |
| `CourseFaculty`        | Many-to-many: course ↔ faculty                                                    |
| `Timetable`            | A resolved schedule for a branch/semester/section                                 |
| `TimetableSlot`        | Single period slot in a timetable (day, period, course, room, faculty)            |
| `ImportJob`            | Tracks a PDF/CSV import job through its pipeline stages                           |
| `ScannedTimetable`     | Raw Gemini-parsed timetable (before integration)                                  |
| `ScannedCourse`        | Course row from a scanned timetable                                               |
| `ScannedScheduleEntry` | Schedule row from a scanned timetable                                             |

### PDF Import Pipeline

```
POST /api/imports/pdf
  └─► ImportJob created (QUEUED)
      └─► pdf-conversion worker   → PARSING        (pdf2pic → PNG images)
          └─► ocr-page worker ×N  → OCR_PROCESSING  (Tesseract.js per page)
              └─► ocr-aggregator  → GEMINI_PARSING  (merge pages)
                  └─► gemini-parsing worker          (Gemini Flash vision)
                      └─► validation worker          (Zod schema check; retry once)
                          └─► database worker        → INTEGRATING → COMPLETED
                              └─► ScannedTimetable + ScannedCourse + ScannedScheduleEntry

POST /api/imports/jobs/:id/integrate
  └─► TimetableIntegrationService
      └─► Fuzzy-match branch, courses, rooms, faculty
          └─► Create Timetable + TimetableSlot records
```

### Key API Endpoints

| Method | Path                                    | Description                                         |
| ------ | --------------------------------------- | --------------------------------------------------- |
| POST   | `/api/auth/login`                       | Cookie-based JWT login                              |
| POST   | `/api/auth/logout`                      | Clear session cookie                                |
| GET    | `/api/auth/me`                          | Current user                                        |
| GET    | `/api/timetables`                       | Paginated timetable list                            |
| GET    | `/api/timetables/:id`                   | Timetable with all slots                            |
| GET    | `/api/timetables/:id/grid`              | Timetable as day×period grid                        |
| POST   | `/api/imports/pdf`                      | Upload PDF to start pipeline                        |
| POST   | `/api/imports/csv/:entity`              | Bulk CSV import (departments/rooms/faculty/courses) |
| GET    | `/api/imports/jobs`                     | List import jobs                                    |
| POST   | `/api/imports/jobs/:id/integrate`       | Convert scanned data → real timetable               |
| POST   | `/api/imports/jobs/:id/retry`           | Retry failed job                                    |
| GET    | `/api/analytics/summary`                | KPI counts                                          |
| GET    | `/api/analytics/room-utilisation`       | Utilisation % per department                        |
| GET    | `/api/analytics/under-running-courses`  | Courses with fewer slots than credits               |
| GET    | `/api/analytics/empty-room-probability` | Probability a room is empty by slot                 |

---

## Frontend

**Runtime:** Node / Bun · **Framework:** Next.js 16 (App Router) · **Styling:** Tailwind CSS v4  
**Tables:** TanStack Table v8 · **Charts:** Recharts 3 · **Icons:** Lucide React · **Forms:** React Hook Form + Zod

### Source Layout

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── page.tsx                # Root redirect (→ /dashboard or /login)
│   ├── globals.css             # Tailwind directives + custom utility classes
│   ├── login/page.tsx          # Login form
│   ├── dashboard/page.tsx      # Analytics dashboard (KPI cards + charts)
│   ├── timetables/page.tsx     # Weekly grid timetable viewer
│   ├── imports/page.tsx        # PDF/CSV upload + job history + integrate button
│   ├── departments/page.tsx    # Department CRUD table
│   ├── rooms/page.tsx          # Room CRUD table
│   ├── courses/page.tsx        # Course CRUD table
│   └── faculty/page.tsx        # Faculty CRUD table
│
├── components/
│   ├── layout.tsx              # Sidebar + header shell (role-based nav)
│   ├── data-table.tsx          # Generic TanStack Table wrapper
│   └── ui/
│       └── table.tsx           # Shadcn-style table primitives
│
├── lib/
│   ├── api.ts                  # Typed fetch client (ApiClient class, credentials: include)
│   ├── auth-context.tsx        # React context — user, login, logout, loading
│   ├── utils.ts                # Tailwind class merge helper (clsx + tailwind-merge)
│   └── hooks/
│       └── use-socket.ts       # Socket.IO hook for import progress updates
│
└── public/
    └── anugat_logo.png
```

### Pages

| Route          | Role               | Description                                    |
| -------------- | ------------------ | ---------------------------------------------- |
| `/login`       | All                | Email/password login                           |
| `/dashboard`   | HOD, DEAN, ADMIN   | Analytics: KPIs, charts, under-running courses |
| `/timetables`  | All                | Select a timetable → view weekly 9-period grid |
| `/imports`     | COORDINATOR, ADMIN | Upload PDFs/CSVs, track pipeline, integrate    |
| `/departments` | ADMIN              | CRUD for departments                           |
| `/rooms`       | COORDINATOR, ADMIN | CRUD for rooms                                 |
| `/courses`     | HOD, ADMIN         | CRUD for courses                               |
| `/faculty`     | HOD, ADMIN         | CRUD for faculty users                         |

### Real-time Updates

The imports page subscribes to Socket.IO events (`subscribe:import` → `import:progress`) so the progress bar and status badge update live as the PDF pipeline advances through its stages.

---

## Getting Started

### Prerequisites

- **Bun** ≥ 1.2
- **Node.js** ≥ 20 (for the frontend dev server)
- **Redis** (local or remote) — must use `maxmemory-policy noeviction`
- **PostgreSQL** (or Prisma Accelerate URL)

### Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
bun install
bun run db:migrate     # run Prisma migrations
bun run db:seed        # optional: seed demo data
bun run dev            # hot-reload dev server on :3001
```

### Frontend

```bash
cd frontend
bun install            # or npm install
bun run dev            # Next.js dev server on :3000
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Backend (`.env`)

| Variable         | Description                                        |
| ---------------- | -------------------------------------------------- |
| `DATABASE_URL`   | Prisma Accelerate or direct PostgreSQL URL         |
| `REDIS_URL`      | Redis connection URL (`redis://…` or `rediss://…`) |
| `JWT_SECRET`     | Secret used to sign session tokens                 |
| `PORT`           | API server port (default `3001`)                   |
| `FRONTEND_URL`   | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `UPLOAD_DIR`     | Directory for uploaded PDFs (default `uploads/`)   |
| `GEMINI_API_KEY` | Google AI Studio API key                           |

---

## Docker

Both services ship a `Dockerfile`. A `docker-compose` file is not included but each container expects the environment variables above and a shared Redis + PostgreSQL instance.

```bash
# Backend
cd backend && docker build -t samayak-backend .

# Frontend
cd frontend && docker build -t samayak-frontend .
```

---

## Tech Stack Summary

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Frontend framework | Next.js 16 (App Router), React 19         |
| Styling            | Tailwind CSS v4, lucide-react             |
| Data tables        | @tanstack/react-table                     |
| Charts             | Recharts 3                                |
| Forms              | react-hook-form + Zod v4                  |
| Real-time          | socket.io-client                          |
| Backend framework  | Hono 4 on Bun                             |
| Database           | PostgreSQL via Prisma 7 + Accelerate      |
| Job queue          | BullMQ 5 + ioredis                        |
| AI parsing         | Google Gemini (Flash) via `@google/genai` |
| OCR                | Tesseract.js 7                            |
| PDF → images       | pdf2pic + Sharp                           |
| Auth               | JOSE JWT (HTTP-only cookie)               |
