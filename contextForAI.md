# Splitwise Clone - Spreetail Assignment — AI Context File

> **Purpose**: Single source of truth for the project. Enables seamless continuation across AI tools, accounts, and sessions.
> **Last Updated**: 2026-06-12 (Backend + Frontend implementation complete, pre-CSV)

---

## Current Project Status

- **Phase**: Implementation — Core modules complete, awaiting CSV file
- **Completed Stages**:
  - [x] Requirement Analysis
  - [x] Architecture Design
  - [x] Database Design — 11-table Prisma schema created
  - [x] API Design — 30 endpoints designed
  - [x] Anomaly Detection Design — 7 types confirmed
  - [x] Project Setup — monorepo (client + server)
  - [x] PostgreSQL + Prisma Setup — schema.prisma with all 11 models
  - [x] Authentication Module — register, login, JWT, profile
  - [x] Group Management Module — CRUD, soft delete
  - [x] Membership Module — add/remove, temporal queries (raw SQL)
  - [x] Expense Module — all 4 split types, multi-currency, membership validation
  - [x] Balance Calculation Engine — net balances + greedy debt simplification
  - [x] Settlement Module — record and list settlements
  - [x] Audit Logging — activity_logs for all CRUD operations
  - [x] CSV Import Framework — placeholder (no parsing logic yet)
  - [x] React Frontend — Auth, Dashboard, Group Detail (5 tabs), Modals
- **Awaiting**:
  - [ ] `expenses_export.csv` — needed for CSV parsing, anomaly detection, and import workflow
- **Not Started**:
  - [ ] Anomaly Detection Rules (blocked by CSV)
  - [ ] CSV Parsing Logic (blocked by CSV)
  - [ ] Import Report Generation (blocked by CSV)
  - [ ] Testing
  - [ ] Deployment

---

## Decisions Made

### Confirmed by User (Final)

| # | Decision | Details | Date |
|---|----------|---------|------|
| D1 | **ORM** | Prisma ORM for schema, migrations, CRUD. Raw SQL for temporal queries. | 2026-06-12 |
| D2 | **Multi-currency** | `original_amount`, `original_currency`, `exchange_rate`, `normalized_amount`. Normalized values for balances. | 2026-06-12 |
| D3 | **Anomaly types** | 7 confirmed: `duplicate_expense`, `amount_outlier`, `membership_violation`, `future_dated`, `missing_fields`, `invalid_split`, `unknown_participant` | 2026-06-12 |
| D4 | **Approval authority** | Uploader only. Item-level approve/reject. | 2026-06-12 |
| D5 | **Frontend** | React + Tailwind CSS (v4 via @tailwindcss/vite) | 2026-06-12 |
| D6 | **Backend** | Node.js + Express | 2026-06-12 |
| D7 | **Database** | PostgreSQL (Neon) | 2026-06-12 |
| D8 | **Deployment** | Vercel (FE), Render (BE), Neon (DB) | 2026-06-12 |
| D9 | **Group roles** | Flat membership, no admin/member distinction | 2026-06-12 |
| D10 | **Expense audit logging** | All CRUD logged in activity_logs table | 2026-06-12 |
| D11 | **Member leaves group** | Debts persist, historical expenses valid, future expenses excluded | 2026-06-12 |
| D12 | **Split types** | Equal, Exact, Percentage, Shares (extensible for CSV) | 2026-06-12 |
| D13 | **Multiple payers** | Single payer per expense initially | 2026-06-12 |
| D14 | **Conversion rate** | Manual entry + optional API fetch. Rate persisted per expense. | 2026-06-12 |
| D15 | **CSV format** | Pending CSV analysis | 2026-06-12 |
| D16 | **CSV columns** | Pending CSV analysis | 2026-06-12 |

### Confirmed Recommendations

| # | Decision | Details |
|---|----------|---------|
| R1 | Auth | Email/password with JWT Bearer tokens |
| R2 | Email verification | Skipped |
| R3 | Password reset | Skipped |
| R4 | Rejoin | Allowed (new membership record) |
| R5 | Group deletion | Soft delete (is_active flag) |
| R6 | Backdating | Allowed |
| R7 | Expense deletion | Soft delete (is_deleted flag) |
| R8 | Partial import | Import valid rows, flag invalid |
| R9 | Outlier threshold | >2× avg OR >$10K cap |
| R10 | Approval granularity | Item-level |
| R11 | Architecture | 3-layer, feature-based modules |
| R12 | Primary keys | UUIDs |
| R13 | Group base currency | Per-group, default USD |

---

## Database State

### Schema Status: CREATED (not yet migrated — needs DATABASE_URL)

**Tables Implemented**: 11

| Table | Status | Model File |
|-------|--------|-----------|
| `users` | ✅ Implemented | `schema.prisma` |
| `groups` | ✅ Implemented | `schema.prisma` |
| `group_memberships` | ✅ Implemented | `schema.prisma` |
| `expenses` | ✅ Implemented | `schema.prisma` |
| `expense_splits` | ✅ Implemented | `schema.prisma` |
| `settlements` | ✅ Implemented | `schema.prisma` |
| `csv_imports` | ✅ Implemented | `schema.prisma` |
| `import_items` | ✅ Implemented | `schema.prisma` |
| `anomaly_flags` | ✅ Implemented | `schema.prisma` |
| `import_decisions` | ✅ Implemented | `schema.prisma` |
| `activity_logs` | ✅ Implemented | `schema.prisma` |

---

## API State

### Implemented Endpoints

| Method | Endpoint | Module | Status |
|--------|----------|--------|--------|
| POST | `/api/auth/register` | Auth | ✅ |
| POST | `/api/auth/login` | Auth | ✅ |
| GET | `/api/auth/me` | Auth | ✅ |
| POST | `/api/groups` | Groups | ✅ |
| GET | `/api/groups` | Groups | ✅ |
| GET | `/api/groups/:groupId` | Groups | ✅ |
| PUT | `/api/groups/:groupId` | Groups | ✅ |
| DELETE | `/api/groups/:groupId` | Groups | ✅ |
| POST | `/api/groups/:groupId/members` | Memberships | ✅ |
| DELETE | `/api/groups/:groupId/members/:userId` | Memberships | ✅ |
| GET | `/api/groups/:groupId/members` | Memberships | ✅ |
| GET | `/api/groups/:groupId/members/history` | Memberships | ✅ |
| POST | `/api/groups/:groupId/expenses` | Expenses | ✅ |
| GET | `/api/groups/:groupId/expenses` | Expenses | ✅ |
| GET | `/api/expenses/:expenseId` | Expenses | ✅ |
| PUT | `/api/expenses/:expenseId` | Expenses | ✅ |
| DELETE | `/api/expenses/:expenseId` | Expenses | ✅ |
| GET | `/api/groups/:groupId/balances` | Balances | ✅ |
| GET | `/api/balances/me` | Balances | ✅ |
| POST | `/api/groups/:groupId/settlements` | Settlements | ✅ |
| GET | `/api/groups/:groupId/settlements` | Settlements | ✅ |
| POST | `/api/groups/:groupId/imports` | Imports | ✅ (placeholder) |
| GET | `/api/groups/:groupId/imports` | Imports | ✅ |
| GET | `/api/imports/:importId` | Imports | ✅ |
| GET | `/api/imports/:importId/items` | Imports | ✅ |
| POST | `/api/imports/:importId/items/:itemId/decide` | Imports | ✅ |
| POST | `/api/imports/:importId/finalize` | Imports | ✅ (placeholder) |
| GET | `/api/imports/:importId/decisions` | Imports | ✅ |
| GET | `/api/imports/:importId/report` | Imports | ✅ (placeholder) |
| GET | `/api/health` | System | ✅ |

**Total: 30 endpoints implemented**

---

## Folder Structure

```
splitwise-clone-spreetail/
├── client/                              # React + Tailwind frontend
│   ├── public/
│   ├── src/
│   │   ├── api/                         # Axios client + API functions
│   │   │   ├── client.js
│   │   │   └── index.js
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── GroupDetailPage.jsx
│   │   ├── utils/
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                              # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                # 11 models
│   │   └── seed.js                      # Demo data (4 users + 1 group)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── database.js
│   │   │   └── constants.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   ├── validation.middleware.js
│   │   │   └── upload.middleware.js
│   │   ├── modules/
│   │   │   ├── auth/          (5 files)
│   │   │   ├── groups/        (5 files)
│   │   │   ├── memberships/   (5 files)
│   │   │   ├── expenses/      (5 files)
│   │   │   ├── balances/      (3 files)
│   │   │   ├── settlements/   (5 files)
│   │   │   └── imports/       (5 files)
│   │   ├── utils/
│   │   │   ├── apiResponse.js
│   │   │   └── activityLogger.js
│   │   └── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── contextForAI.md
├── README.md
└── LICENSE
```

---

## Business Rules

### Implemented Rules

1. **Membership-aware balances**: Expenses only affect members active on `expense_date` (checked via raw SQL `isMemberOnDate` query).
2. **Debts persist after leaving**: Member removal sets `left_at` and `status=inactive`. Historical debts remain.
3. **Single payer per expense**: Enforced in validation schema.
4. **Split validation**: Equal (cent-precise distribution), Exact (sum must equal total), Percentage (must sum to 100), Shares (proportional with remainder distribution).
5. **Uploader approval only**: `decideItem` checks `csvImport.uploadedById === userId`.
6. **Error-severity items cannot be approved**: Enforced in `decideItem`.
7. **Multi-currency normalization**: `normalizedAmount = originalAmount × exchangeRate`. Balances use normalized amounts.
8. **Exchange rate persistence**: Stored per expense/settlement.
9. **Audit trail**: All expense CRUD, member add/remove, group CRUD, settlements, and import decisions logged in `activity_logs`.
10. **Flat permissions**: No role checks — any member can perform any action in their group.
11. **Soft deletes**: Expenses (`is_deleted`), Groups (`is_active`).
12. **Rejoin support**: New `group_membership` record with new `joined_at`. Unique constraint on `(groupId, userId, joinedAt)`.

---

## Anomaly Policies

### Confirmed Types (7) — Rules NOT yet implemented (pending CSV)

| # | Type | Severity | Status |
|---|------|----------|--------|
| 1 | `duplicate_expense` | warning | Designed, not implemented |
| 2 | `amount_outlier` | warning | Designed, not implemented |
| 3 | `membership_violation` | warning | Designed, not implemented |
| 4 | `future_dated` | warning | Designed, not implemented |
| 5 | `missing_fields` | error | Designed, not implemented |
| 6 | `invalid_split` | error | Designed, not implemented |
| 7 | `unknown_participant` | error | Designed, not implemented |

---

## Pending Tasks

1. [x] Project Setup
2. [x] PostgreSQL + Prisma Setup
3. [x] Authentication Module
4. [x] Group Management Module
5. [x] Membership Module
6. [x] Expense Module
7. [x] Balance Calculation Engine
8. [x] Settlement Module
9. [x] Audit Logging
10. [x] CSV Import Framework (placeholder)
11. [x] React Frontend (Auth, Dashboard, Groups, Expenses, Balances, Settlements)
12. [/] CSV Analysis — awaiting `expenses_export.csv`
13. [ ] Anomaly Detection Rules
14. [ ] CSV Parsing Logic
15. [ ] Import Report Generation
16. [ ] Testing
17. [ ] Deployment

---

## Risks

| Risk | Severity | Notes |
|------|----------|-------|
| CSV format undefined | **High** | Blocks anomaly rules, parsing, and import workflow |
| Database not yet migrated | Medium | Need DATABASE_URL to run `prisma migrate dev` |
| No tests written yet | Medium | Testing stage is pending |

---

## Next Recommended Step

**Provide `expenses_export.csv`** → Then:
1. Analyze CSV structure
2. Identify split types and anomaly patterns
3. Implement CSV parsing + anomaly detectors
4. Build import report generation
5. Update this file

**To run the project locally**:
1. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `JWT_SECRET`
2. Run `cd server && npm run db:push` to create tables
3. Run `cd server && npm run db:seed` to add demo data
4. Run `cd server && npm run dev` to start backend
5. Run `cd client && npm run dev` to start frontend
6. Open `http://localhost:5173`

---

## Handoff Summary

**Splitwise Clone — Spreetail Internship Assignment**

Tech: React + Tailwind v4 (Vite) | Node.js + Express + Prisma | PostgreSQL (Neon)

**What's built**: Full-stack expense sharing app with:
- JWT auth (register/login/profile)
- Group CRUD with soft delete
- Temporal membership (joined_at/left_at, rejoin support, raw SQL date-range checks)
- Expense CRUD with 4 split types (Equal/Exact/Percentage/Shares), multi-currency, membership validation
- Balance calculation engine with greedy debt simplification
- Settlement recording
- CSV import framework (placeholder — no parsing yet)
- Item-level approve/reject workflow with uploader-only enforcement
- Decision and activity logging
- Dark-themed React UI with glassmorphism, gradient buttons, dashboard with balance summary, group detail with 5 tabs

**What's NOT built**: CSV parsing logic, anomaly detection rules, import report generation, tests, deployment.

**Blocker**: `expenses_export.csv` file. Once provided, analyze it → build detectors → implement parsing → generate reports.

**To continue**: Read this file → set up .env → run migrations → provide CSV → implement remaining modules.
