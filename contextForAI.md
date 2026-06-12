# Splitwise Clone - Spreetail Assignment — AI Context File

> **Purpose**: Single source of truth for the project. Enables seamless continuation across AI tools, accounts, and sessions.
> **Last Updated**: 2026-06-12 (Backend + Frontend implementation complete, pre-CSV)

---

## 1. Product Understanding

### What Is This?
A **Shared Expenses Application** inspired by Splitwise, built as a software engineering internship assignment for **Spreetail**. It enables users to track shared expenses within groups, split costs using multiple methods, settle debts, and import historical data from CSV files with anomaly detection.

### Who Uses It?
- **Roommates** splitting rent, groceries, utilities
- **Travel groups** tracking trip expenses across currencies
- **Teams/friends** managing shared costs

### Core User Flows
1. **Register/Login** → Create/join a group → Add expenses → View balances → Settle up
2. **CSV Import** → Upload historical CSV → System flags anomalies → User reviews & approves → Expenses created

### What Makes It Different From a Basic Splitwise?
- **Temporal membership tracking** — members can join/leave, and balances correctly compute only for active periods
- **Multi-currency support** — original amounts preserved with conversion rates for audit
- **CSV import engine with anomaly detection** — 7 anomaly types with item-level review workflow
- **Full audit trail** — every action logged in activity_logs

---

## 2. Product Scope

### In Scope (Must Have)
| Feature | Status |
|---------|--------|
| Email/password authentication (JWT) | ✅ Implemented |
| Group CRUD with soft delete | ✅ Implemented |
| Dynamic group memberships (join/leave/rejoin) | ✅ Implemented |
| Temporal membership (affects balance calculations) | ✅ Implemented |
| Expense tracking (4 split types) | ✅ Implemented |
| Multi-currency support (original + normalized) | ✅ Implemented |
| Debt settlement recording | ✅ Implemented |
| Balance calculation with greedy debt simplification | ✅ Implemented |
| Audit logging for all operations | ✅ Implemented |
| CSV import engine with anomaly detection | ⏳ Framework built, parsing pending CSV |
| Approval workflow (uploader approves/rejects flagged items) | ✅ Framework implemented |
| Import report generation | ⏳ Pending CSV |
| React dashboard with group management | ✅ Implemented |

### Out of Scope (Explicitly Excluded)
| Feature | Reason |
|---------|--------|
| Email verification | Assignment scope — not required |
| Password reset | Assignment scope — not required |
| Admin/member roles | Decision D9: flat membership |
| Real-time notifications | Beyond assignment requirements |
| Mobile app | Web-only assignment |
| OAuth / social login | Simple auth is sufficient |
| Recurring expenses | Not in requirements |
| Receipt image upload | Not in requirements |

---

## 3. Implementation Decisions

### Confirmed by User (Final)

| # | Decision | Details | Rationale | Date |
|---|----------|---------|-----------|------|
| D1 | **ORM** | Prisma ORM for schema, migrations, CRUD. Raw SQL for temporal queries only. | Prisma is ergonomic for most queries; raw SQL needed for `joined_at <= D AND (left_at IS NULL OR left_at >= D)` which Prisma can't express | 2026-06-12 |
| D2 | **Multi-currency** | Store `original_amount`, `original_currency`, `exchange_rate`, `normalized_amount` | Audit trail for original values; normalized amounts enable consistent balance math | 2026-06-12 |
| D3 | **Anomaly types** | 7 confirmed: `duplicate_expense`, `amount_outlier`, `membership_violation`, `future_dated`, `missing_fields`, `invalid_split`, `unknown_participant` | Covers data quality, temporal integrity, and format validation | 2026-06-12 |
| D4 | **Approval authority** | Uploader only. Item-level approve/reject. | The person who uploaded the CSV understands the data best | 2026-06-12 |
| D5 | **Frontend** | React + Tailwind CSS v4 (via @tailwindcss/vite) | Modern, fast build with Vite | 2026-06-12 |
| D6 | **Backend** | Node.js + Express | Standard, well-supported stack | 2026-06-12 |
| D7 | **Database** | PostgreSQL (Neon for hosting) | Relational model fits the domain; Neon for serverless hosting | 2026-06-12 |
| D8 | **Deployment** | Vercel (FE), Render (BE), Neon (DB) | Free tier availability; separation of concerns | 2026-06-12 |
| D9 | **Group roles** | Flat membership — no admin/member distinction | Assignment focuses on expense logic, not authorization complexity | 2026-06-12 |
| D10 | **Audit logging** | All CRUD logged in `activity_logs` table | Required for anomaly review and debugging import decisions | 2026-06-12 |
| D11 | **Member leaves group** | Debts persist, historical expenses remain valid, future expenses excluded | Prevents debt erasure on exit; temporal query handles exclusion | 2026-06-12 |
| D12 | **Split types** | Equal, Exact, Percentage, Shares (extensible for CSV-discovered types) | Covers standard Splitwise types; CSV may add more | 2026-06-12 |
| D13 | **Multiple payers** | Single payer per expense initially | Simplifies schema; revisit if CSV shows multi-payer | 2026-06-12 |
| D14 | **Conversion rate** | Manual entry. Rate persisted per expense. No external API. | Imported historical data must be reproducible; API rates change | 2026-06-12 |
| D15 | **CSV format** | Pending CSV analysis | — | — |
| D16 | **CSV columns** | Pending CSV analysis | — | — |

### Confirmed Recommendations

| # | Decision | Details |
|---|----------|---------|
| R1 | Auth | Email/password with JWT Bearer tokens |
| R2 | Email verification | Skipped |
| R3 | Password reset | Skipped |
| R4 | Rejoin | Allowed (new membership record with new `joined_at`) |
| R5 | Group deletion | Soft delete (`is_active` flag) |
| R6 | Backdating | Allowed (expenses can have past dates) |
| R7 | Expense deletion | Soft delete (`is_deleted` flag) |
| R8 | Partial import | Import valid rows, flag invalid rows |
| R9 | Outlier threshold | >2× group average OR >$10,000 absolute cap |
| R10 | Approval granularity | Item-level (each CSV row individually) |
| R11 | Architecture | 3-layer clean architecture (Controller → Service → Repository), feature-based modules |
| R12 | Primary keys | UUIDs (collision-safe across environments) |
| R13 | Group base currency | Per-group, default USD |

---

## 4. Engineering Requirements

### Performance
- Pagination on all list endpoints (default 20, max 100)
- Database indexes on frequently queried columns (group_id, user_id, status, expense_date)
- Prisma client singleton to prevent connection pool exhaustion in dev

### Security
- Passwords hashed with bcrypt (12 salt rounds)
- JWT tokens with configurable expiration (default 7d)
- All API routes (except register/login) protected by auth middleware
- Environment variables validated on startup; server exits if missing
- File upload limited to .csv only, with configurable max size (default 10MB)
- CORS restricted to configured client URL

### Reliability
- All multi-step operations wrapped in Prisma `$transaction`
- Audit logging is fire-and-forget (failures don't crash the main operation)
- Global error handler catches Prisma, Zod, JWT, Multer, and custom errors
- Soft deletes prevent accidental data loss

### Code Quality
- 3-layer architecture enforced: Controllers never touch Prisma directly
- Zod schemas validate all inputs before reaching service layer
- Standardized API response format via `ApiResponse` utility
- Centralized constants file for all enums and magic values
- JSDoc comments on all service methods

---

## 5. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19.x | UI framework |
| | Vite | 8.x | Build tool & dev server |
| | Tailwind CSS | 4.x | Styling (via @tailwindcss/vite plugin) |
| | React Router | 7.x | Client-side routing |
| | Axios | 1.x | HTTP client with JWT interceptors |
| | React Hot Toast | 2.x | Toast notifications |
| | Lucide React | latest | Icon library |
| **Backend** | Node.js | 22.x | Runtime |
| | Express | 5.x | HTTP framework |
| | Prisma ORM | 7.x | Database ORM + migrations |
| | Zod | 4.x | Input validation |
| | bcryptjs | 3.x | Password hashing |
| | jsonwebtoken | 9.x | JWT token generation/verification |
| | Multer | 2.x | File upload handling |
| | dotenv | 17.x | Environment variable loading |
| | cors | 2.x | Cross-origin resource sharing |
| **Database** | PostgreSQL | 15+ | Relational database |
| | Neon | — | Serverless PostgreSQL hosting |
| **Dev Tools** | nodemon | 3.x | Auto-restart on file changes |
| **Deployment** | Vercel | — | Frontend hosting |
| | Render | — | Backend hosting |

---

## 6. Database Schema

### Schema Status: CREATED (not yet migrated — needs DATABASE_URL)

**Total Tables**: 11 | **Schema File**: `server/prisma/schema.prisma`

### Entity Relationship Diagram

```
User (1) ──→ (N) GroupMembership (N) ←── (1) Group
User (1) ──→ (N) Expense (N) ←── (1) Group
User (1) ──→ (N) ExpenseSplit (N) ←── (1) Expense
User (1) ──→ (N) Settlement (N) ←── (1) Group
User (1) ──→ (N) CsvImport (N) ←── (1) Group
CsvImport (1) ──→ (N) ImportItem (1) ──→ (N) AnomalyFlag
ImportItem (1) ──→ (N) ImportDecision ←── (1) User
ImportItem (1) ──→ (0..1) Expense
User (1) ──→ (N) ActivityLog
```

### Table Details

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-generated |
| email | String | UNIQUE |
| name | String | — |
| password_hash | String | bcrypt hash |
| created_at | DateTime | auto |
| updated_at | DateTime | auto |

#### `groups`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | String | — |
| description | String? | nullable |
| base_currency | VARCHAR(3) | default "USD" |
| created_by | UUID | FK → users |
| is_active | Boolean | default true (soft delete flag) |
| created_at / updated_at | DateTime | auto |

#### `group_memberships` (TEMPORAL)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → groups |
| user_id | UUID | FK → users |
| joined_at | DateTime | default now() |
| left_at | DateTime? | null = still active |
| status | VARCHAR(20) | 'active' / 'inactive' |

**Unique constraint**: `(group_id, user_id, joined_at)` — enables rejoin with new record
**Indexes**: `(group_id, status)`, `(user_id)`

#### `expenses` (MULTI-CURRENCY)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → groups |
| paid_by | UUID | FK → users |
| description | String | — |
| original_amount | Decimal(12,2) | — |
| original_currency | VARCHAR(3) | — |
| exchange_rate | Decimal(12,6) | default 1.0 |
| normalized_amount | Decimal(12,2) | = original × rate |
| split_type | VARCHAR(20) | equal/exact/percentage/shares |
| expense_date | Date | — |
| created_by | UUID | FK → users |
| import_item_id | UUID? | UNIQUE, FK → import_items |
| is_deleted | Boolean | default false (soft delete) |

**Indexes**: `(group_id, is_deleted)`, `(group_id, expense_date)`

#### `expense_splits`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| expense_id | UUID | FK → expenses |
| user_id | UUID | FK → users |
| original_amount | Decimal(12,2) | — |
| normalized_amount | Decimal(12,2) | — |
| percentage | Decimal(5,2)? | for percentage splits |
| shares | Int? | for shares splits |

#### `settlements` (MULTI-CURRENCY)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → groups |
| payer_id | UUID | FK → users (who paid) |
| payee_id | UUID | FK → users (who received) |
| original_amount | Decimal(12,2) | — |
| original_currency | VARCHAR(3) | — |
| exchange_rate | Decimal(12,6) | default 1.0 |
| normalized_amount | Decimal(12,2) | — |
| settled_at | DateTime | default now() |
| created_by | UUID | FK → users |

#### `csv_imports`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → groups |
| uploaded_by | UUID | FK → users |
| file_name | String | original filename |
| status | VARCHAR(30) | processing/pending_review/completed/partially_completed/failed |
| total_rows / valid_rows / flagged_rows / approved_rows / rejected_rows | Int | counters |

#### `import_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| import_id | UUID | FK → csv_imports |
| row_number | Int | 1-indexed CSV row |
| raw_data | JSON | original CSV row |
| parsed_data | JSON? | normalized/transformed data |
| status | VARCHAR(20) | pending/clean/flagged/approved/rejected/error |

#### `anomaly_flags`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| import_item_id | UUID | FK → import_items |
| anomaly_type | VARCHAR(30) | one of 7 types |
| severity | VARCHAR(10) | error/warning/info |
| details | String | human-readable explanation |

#### `import_decisions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| import_item_id | UUID | FK → import_items |
| decision | VARCHAR(10) | approve/reject |
| decided_by | UUID | FK → users |
| reason | String? | optional explanation |
| decided_at | DateTime | auto |

#### `activity_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| action | VARCHAR(50) | e.g., expense_created |
| entity_type | VARCHAR(20) | e.g., expense |
| entity_id | UUID | — |
| metadata | JSON? | additional context |
| created_at | DateTime | auto |

**Indexes**: `(entity_type, entity_id)`, `(user_id)`

---

## 7. API Design

### Response Format

All endpoints return consistent JSON:

```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Paginated
{ "success": true, "message": "...", "data": [...], "pagination": { "total": 50, "page": 1, "limit": 20, "totalPages": 3, "hasMore": true } }

// Error
{ "success": false, "message": "...", "errors": [{ "field": "email", "message": "Invalid email" }] }
```

### Endpoints (30 total)

#### Auth (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with name, email, password |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Get current user profile (🔒) |

#### Groups (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create group (auto-adds creator as member) |
| GET | `/api/groups` | List user's active groups |
| GET | `/api/groups/:groupId` | Get group details |
| PUT | `/api/groups/:groupId` | Update group name/description/currency |
| DELETE | `/api/groups/:groupId` | Archive (soft delete) group |

#### Memberships (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/:groupId/members` | Add member by email |
| DELETE | `/api/groups/:groupId/members/:userId` | Remove member (debts persist) |
| GET | `/api/groups/:groupId/members` | List active members |
| GET | `/api/groups/:groupId/members/history` | Full membership timeline |

#### Expenses (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/:groupId/expenses` | Create expense with splits |
| GET | `/api/groups/:groupId/expenses` | List group expenses (paginated) |
| GET | `/api/expenses/:expenseId` | Get expense details |
| PUT | `/api/expenses/:expenseId` | Update expense and recalculate splits |
| DELETE | `/api/expenses/:expenseId` | Soft-delete expense |

#### Balances (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:groupId/balances` | Group balances + simplified debts |
| GET | `/api/balances/me` | User's cross-group balance summary |

#### Settlements (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/:groupId/settlements` | Record a payment between users |
| GET | `/api/groups/:groupId/settlements` | List group settlements |

#### Imports (🔒 All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/:groupId/imports` | Upload CSV file |
| GET | `/api/groups/:groupId/imports` | List group's imports |
| GET | `/api/imports/:importId` | Get import details |
| GET | `/api/imports/:importId/items` | List import items (filterable by status) |
| POST | `/api/imports/:importId/items/:itemId/decide` | Approve/reject item (uploader only) |
| POST | `/api/imports/:importId/finalize` | Finalize import (create expenses) |
| GET | `/api/imports/:importId/decisions` | Get decision log |
| GET | `/api/imports/:importId/report` | Get import report |

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

---

## 8. Frontend Structure

### Architecture
- **Routing**: React Router v7 with protected/public route wrappers
- **State**: React Context (AuthContext) + component-level useState
- **API Layer**: Centralized Axios client with JWT interceptor and auto-logout on 401
- **Styling**: Tailwind CSS v4 + custom CSS (glassmorphism, gradients, animations)
- **Fonts**: Inter (Google Fonts)
- **Icons**: Lucide React

### Pages

| Page | Route | Features |
|------|-------|----------|
| LoginPage | `/login` | Email/password form, gradient branding, error display |
| RegisterPage | `/register` | Name/email/password/confirm, password match validation |
| DashboardPage | `/` | Balance summary cards (owed/owing/net), group list with avatars, create group modal |
| GroupDetailPage | `/groups/:groupId` | 5 tabs (Expenses, Balances, Members, Settlements, History), 3 modals |

### Modals
- **CreateGroupModal** — name, description, base currency
- **AddExpenseModal** — description, amount, currency, exchange rate, payer, date, split type (4 types), participant selection with per-type inputs
- **AddMemberModal** — email input
- **SettlementModal** — payer, payee, amount, currency

### Design System
- Dark theme (`#0f172a` background, `#1e293b` cards)
- Glassmorphism (backdrop-blur, translucent borders)
- Gradient text branding (`#6366f1` → `#06b6d4`)
- Color-coded balances (emerald for positive, red for negative)
- Avatar initials with deterministic colors
- Smooth fadeIn animations
- Custom scrollbar styling

### File Map

```
client/src/
├── api/
│   ├── client.js            # Axios instance with interceptors
│   └── index.js             # All API functions by domain
├── contexts/
│   └── AuthContext.jsx       # Auth state, login/register/logout
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   └── GroupDetailPage.jsx
├── utils/
│   └── helpers.js            # formatCurrency, formatDate, getInitials, getAvatarColor
├── App.jsx                   # Router + Toaster + Auth provider
├── main.jsx                  # ReactDOM entry
└── index.css                 # Tailwind + custom design system
```

---

## 9. Deployment Plan

### Targets

| Component | Platform | URL Pattern | Free Tier |
|-----------|----------|-------------|-----------|
| Frontend | Vercel | `*.vercel.app` | ✅ |
| Backend | Render | `*.onrender.com` | ✅ (spins down after 15min idle) |
| Database | Neon | PostgreSQL connection string | ✅ (0.5 GB, auto-suspend) |

### Deployment Steps (Not Yet Executed)

1. **Database (Neon)**:
   - Create Neon project → copy `DATABASE_URL`
   - Run `cd server && npx prisma db push` to create tables
   - Run `cd server && npm run db:seed` to seed demo data

2. **Backend (Render)**:
   - Connect repo → set root directory to `server`
   - Build command: `npm install && npx prisma generate`
   - Start command: `node server.js`
   - Environment variables: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`

3. **Frontend (Vercel)**:
   - Connect repo → set root directory to `client`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `VITE_API_URL=https://<render-url>/api`

### Environment Variables

| Variable | Where | Required |
|----------|-------|----------|
| `DATABASE_URL` | Server | ✅ |
| `JWT_SECRET` | Server | ✅ |
| `JWT_EXPIRES_IN` | Server | No (default: 7d) |
| `PORT` | Server | No (default: 5000) |
| `NODE_ENV` | Server | No (default: development) |
| `CLIENT_URL` | Server | No (default: http://localhost:5173) |
| `MAX_FILE_SIZE_MB` | Server | No (default: 10) |
| `VITE_API_URL` | Client | No (default: /api with Vite proxy) |

---

## 10. Testing Plan (Not Yet Implemented)

### Unit Tests (Planned)
| Module | Priority | What to Test |
|--------|----------|-------------|
| **Split calculations** | P0 | All 4 split types, edge cases (remainder distribution, rounding) |
| **Balance engine** | P0 | Net balance computation, debt simplification algorithm |
| **Temporal membership** | P0 | `isMemberOnDate` with join/leave/rejoin scenarios |
| **Auth service** | P1 | Registration (duplicate check), login (password verify), JWT generation |
| **Anomaly detectors** | P1 | Each of 7 anomaly types with positive/negative cases |

### Integration Tests (Planned)
| Flow | Priority |
|------|----------|
| Register → Login → Create Group → Add Members → Add Expense → Check Balances → Settle | P0 |
| CSV Upload → Review Anomalies → Approve/Reject → Finalize → Verify Expenses Created | P0 |
| Member joins → Expense created → Member leaves → New expense → Verify former member unaffected | P1 |
| Multi-currency expense → Verify normalized balance calculation | P1 |

### Tools
- **Framework**: Jest (backend), Vitest (frontend)
- **Database**: SQLite in-memory or test PostgreSQL

---

## 11. Trade-offs

| Decision | What We Chose | Alternative Considered | Why |
|----------|---------------|----------------------|-----|
| **Prisma + raw SQL** | Prisma for most queries, raw SQL for temporal | Pure raw SQL everywhere | Prisma provides type safety and migration tooling; raw SQL only where Prisma's `where` can't express date-range intersections |
| **Single payer** | One payer per expense | Multi-payer support | Simpler schema and split math. Will revisit if CSV reveals multi-payer patterns |
| **Flat membership** | No roles/permissions | Admin/member roles | Assignment focuses on expense logic. Adding roles would add authorization complexity with little benefit |
| **Soft deletes** | `is_deleted` / `is_active` flags | Hard deletes | Preserves referential integrity for balance calculations and audit trail |
| **JWT in localStorage** | localStorage with Bearer header | httpOnly cookies | Simpler implementation for SPA. Aware of XSS risk; acceptable for assignment |
| **Manual exchange rate** | User enters rate | External API (Open Exchange Rates) | Requirement: "imported historical data should remain reproducible" — API rates change daily |
| **Greedy debt simplification** | Greedy matching (largest debtor ↔ largest creditor) | Min-cost max-flow graph algorithm | Greedy is O(n log n) and produces optimal result for simple cases. Graph algorithm is overkill for typical group sizes |
| **Cent-based arithmetic** | Integer cents for split calculations | Floating-point | Eliminates floating-point rounding errors. Remainder cents distributed fairly |
| **Component-level state** | useState in pages | Redux / Zustand global store | App is not complex enough to warrant a global state manager. Context for auth is sufficient |
| **Tailwind v4** | @tailwindcss/vite plugin | Tailwind v3 with PostCSS | v4 has simpler config, CSS-native, better DX. No `tailwind.config.js` needed |
| **Nodemon** | Hot-reload in dev | ts-node-dev, tsx | Project is JavaScript (not TypeScript), nodemon is the standard choice |

---

## 12. Conversation History & Key AI Interactions

### Session 1: Requirements Gathering

**User established rules**:
- "Do not assume requirements. Ask clarifying questions."
- "Never silently invent business rules."
- "Explain every algorithm used for balance calculations."
- "Produce production-quality code."

**AI asked 20 clarifying questions** covering:
- Group permissions (→ flat membership)
- Expense editing (→ audit logs)
- Member leave behavior (→ debts persist)
- Split types (→ 4 types confirmed)
- Multiple payers (→ single initially)
- CSV format (→ pending)
- Anomaly types (→ 7 confirmed)
- Multi-currency (→ full support confirmed)

### Session 2: Architecture & Schema Design
- Designed 3-layer clean architecture
- Created 11-table Prisma schema with temporal membership and multi-currency
- Confirmed technology choices (PostgreSQL + Prisma, React + Tailwind)

### Session 3: Implementation
- Built all 7 backend modules (38 files)
- Built React frontend (4 pages, 4 modals)
- Verified frontend builds successfully
- Updated contextForAI.md

### Key User Directives
1. "Use PostgreSQL + Prisma ORM. Use raw SQL only for complex temporal membership queries."
2. "All members have the same permissions (flat membership)."
3. "Outstanding debts persist after leaving."
4. "The importer must never depend on an external API."
5. "Before implementation begins [on import engine]: Upload and analyze expenses_export.csv first."
6. "After each completed stage: Update contextForAI.md."

---

## 13. Changes Made During Implementation

### Changelog

| Date | Change | Files Affected | Reason |
|------|--------|---------------|--------|
| 2026-06-12 | Project initialized | `server/package.json` | Setup |
| 2026-06-12 | Prisma schema created (11 models) | `server/prisma/schema.prisma` | Database design |
| 2026-06-12 | Server foundation | `env.js`, `database.js`, `constants.js`, `app.js`, `server.js` | Config + entry points |
| 2026-06-12 | Middleware layer | `auth.middleware.js`, `error.middleware.js`, `validation.middleware.js`, `upload.middleware.js` | Request processing pipeline |
| 2026-06-12 | Utilities | `apiResponse.js`, `activityLogger.js` | Shared helpers |
| 2026-06-12 | Auth module | `auth.{repository,service,controller,routes,validation}.js` | JWT authentication |
| 2026-06-12 | Groups module | `groups.{repository,service,controller,routes,validation}.js` | Group CRUD |
| 2026-06-12 | Memberships module | `memberships.{repository,service,controller,routes,validation}.js` | Temporal membership |
| 2026-06-12 | Expenses module | `expenses.{repository,service,controller,routes,validation}.js` | Expense CRUD + split math |
| 2026-06-12 | Balances module | `balances.{repository,service,controller,routes}.js` | Balance engine |
| 2026-06-12 | Settlements module | `settlements.{repository,service,controller,routes,validation}.js` | Settlement recording |
| 2026-06-12 | Imports module | `imports.{repository,service,controller,routes,validation}.js` | CSV import framework |
| 2026-06-12 | Seed file | `server/prisma/seed.js` | Demo data (4 users + 1 group) |
| 2026-06-12 | React app scaffolded | Vite + React + Tailwind v4 | Frontend setup |
| 2026-06-12 | API layer | `client/src/api/client.js`, `index.js` | Axios with JWT interceptors |
| 2026-06-12 | Auth context | `client/src/contexts/AuthContext.jsx` | Auth state management |
| 2026-06-12 | All pages | `LoginPage`, `RegisterPage`, `DashboardPage`, `GroupDetailPage` | UI implementation |
| 2026-06-12 | Design system | `client/src/index.css` | Dark theme, glassmorphism, animations |
| 2026-06-12 | .gitignore | `.gitignore` | User-created |

---

## 14. Known Limitations

| # | Limitation | Impact | Mitigation Path |
|---|-----------|--------|-----------------|
| 1 | **CSV import not functional** | Cannot import historical data | Blocked until `expenses_export.csv` is provided and analyzed |
| 2 | **No automated tests** | Cannot verify correctness at scale | Testing stage planned (Jest + Vitest) |
| 3 | **No database migrations created** | Schema not applied to any database | Need `DATABASE_URL` → run `prisma db push` or `prisma migrate dev` |
| 4 | **JWT stored in localStorage** | Vulnerable to XSS attacks | Acceptable for assignment; production would use httpOnly cookies |
| 5 | **No rate limiting** | API vulnerable to abuse | Add express-rate-limit for production |
| 6 | **No email verification** | Anyone can register with any email | Out of scope per decision R2 |
| 7 | **Render free tier cold starts** | Backend takes ~30s to wake after idle | Show loading indicator; acceptable for demo |
| 8 | **Single payer per expense** | Cannot represent shared payments | May need revision after CSV analysis (decision D13) |
| 9 | **No real-time updates** | Users must refresh to see others' changes | Could add WebSocket/SSE in future |
| 10 | **Exchange rates are manual** | User must know the rate | By design (D14) — historical reproducibility |
| 11 | **No expense categories/tags** | Cannot categorize expenses | Could be added as a string field later |
| 12 | **Balance calculation not cached** | Recalculated on every request | For small groups (<20 members), this is fine. Could add materialized views for scale |
| 13 | **No file cleanup** | Uploaded CSV files accumulate on disk | Add cron job or lifecycle policy in production |
| 14 | **Anomaly thresholds are hardcoded** | 2× average and $10K cap may not suit all groups | Could make configurable per group in future |

---

## 15. Business Rules (Comprehensive)

### Implemented Rules

1. **Membership-aware balances**: Expenses only affect members active on `expense_date`. Verified via raw SQL: `joined_at <= date AND (left_at IS NULL OR left_at >= date)`.
2. **Debts persist after leaving**: Member removal sets `left_at` and `status=inactive`. Historical debts remain in balance calculations.
3. **Single payer per expense**: Enforced in Zod validation schema.
4. **Split validation algorithms**:
   - **Equal**: `total ÷ count` using integer cents. Remainder pennies distributed to first N participants.
   - **Exact**: Sum of individual amounts must equal total (±$0.01 tolerance).
   - **Percentage**: Sum must equal 100% (±0.01% tolerance). Amount = total × (pct / 100).
   - **Shares**: Amount = total × (userShares / totalShares) using integer cents. Remainder distributed.
5. **Uploader approval only**: `decideItem()` checks `csvImport.uploadedById === userId`.
6. **Error-severity items cannot be approved**: Items with `severity: 'error'` anomalies are blocked from approval.
7. **Multi-currency normalization**: `normalizedAmount = originalAmount × exchangeRate`. All internal balance calculations use `normalizedAmount`.
8. **Exchange rate persistence**: Rate stored per expense and per settlement for audit reproducibility.
9. **Audit trail**: All CRUD operations on expenses, groups, memberships, settlements, and imports create `ActivityLog` entries with metadata JSON.
10. **Flat permissions**: No role checks. Any group member can add/remove members, create expenses, record settlements.
11. **Soft deletes**: Expenses use `is_deleted`, Groups use `is_active`. Soft-deleted items excluded from queries.
12. **Rejoin support**: When a member rejoins, a new `GroupMembership` record is created with a new `joined_at`. Unique constraint `(groupId, userId, joinedAt)` ensures no duplicates.
13. **Greedy debt simplification**: Balance engine sorts debtors/creditors by amount, matches largest pairs, transfers minimum of their balances. Produces minimum number of transactions.

---

## 16. Folder Structure

```
splitwise-clone-spreetail/
├── client/                              # React + Tailwind v4 frontend
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js               # Axios instance + interceptors
│   │   │   └── index.js                # API functions (auth, groups, etc.)
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx          # Auth state + login/register/logout
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx            # Auth form
│   │   │   ├── RegisterPage.jsx         # Registration form
│   │   │   ├── DashboardPage.jsx        # Balance summary + group list
│   │   │   └── GroupDetailPage.jsx      # 5-tab group view + 3 modals
│   │   ├── utils/
│   │   │   └── helpers.js               # Currency/date formatting, avatars
│   │   ├── App.jsx                      # Router + auth provider
│   │   ├── main.jsx                     # Entry point
│   │   └── index.css                    # Tailwind + custom design tokens
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                              # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                # 11 database models
│   │   └── seed.js                      # Demo: Alice, Bob, Charlie, Diana + Roommates group
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                   # Env validation (exits on missing)
│   │   │   ├── database.js              # Prisma singleton
│   │   │   └── constants.js             # Enums, thresholds, config values
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js        # JWT verification
│   │   │   ├── error.middleware.js       # Global error handler
│   │   │   ├── validation.middleware.js  # Zod schema validator
│   │   │   └── upload.middleware.js      # Multer CSV upload
│   │   ├── modules/
│   │   │   ├── auth/                    # repository, service, controller, routes, validation
│   │   │   ├── groups/                  # repository, service, controller, routes, validation
│   │   │   ├── memberships/             # repository (raw SQL), service, controller, routes, validation
│   │   │   ├── expenses/               # repository, service (split math), controller, routes, validation
│   │   │   ├── balances/               # repository (raw SQL), service (debt simplification), controller, routes
│   │   │   ├── settlements/            # repository, service, controller, routes, validation
│   │   │   └── imports/                # repository, service (placeholder), controller, routes, validation
│   │   ├── utils/
│   │   │   ├── apiResponse.js           # Standardized JSON responses
│   │   │   └── activityLogger.js        # Fire-and-forget audit logging
│   │   └── app.js                       # Express setup, route mounting, 404, error handler
│   ├── server.js                        # Entry point
│   ├── .env.example                     # Template for env vars
│   └── package.json
│
├── .gitignore
├── contextForAI.md                      # ← THIS FILE
├── README.md
└── LICENSE
```

---

## 17. Current Project Status (Summary)

| Category | Status |
|----------|--------|
| Backend modules | ✅ 7/7 complete (38 files) |
| API endpoints | ✅ 30/30 implemented |
| Database schema | ✅ Designed (not yet migrated) |
| Frontend pages | ✅ 4 pages + 4 modals |
| Frontend build | ✅ Passes (`vite build` → 328KB JS, 20KB CSS) |
| CSV import engine | ⏳ Framework only (no parsing) |
| Anomaly detection | ⏳ Types designed, rules not implemented |
| Tests | ❌ Not started |
| Deployment | ❌ Not started |

### Next Steps
1. **Provide `expenses_export.csv`** → Analyze → Implement CSV parsing + anomaly detectors
2. Run database migrations with a real `DATABASE_URL`
3. Write tests (split calculations, balance engine, temporal membership)
4. Deploy to Vercel + Render + Neon

---

## 18. How to Continue Development

### For AI Agents
1. Read this entire file
2. Read `server/prisma/schema.prisma` for schema
3. Check `server/src/modules/` for module implementations
4. Check `client/src/pages/` for UI components
5. If CSV file is available, analyze it first before coding

### For Humans
1. `git clone` → `cd server` → `cp .env.example .env` → fill in values
2. `npm install` in both `server/` and `client/`
3. `cd server && npm run db:push && npm run db:seed`
4. Terminal 1: `cd server && npm run dev`
5. Terminal 2: `cd client && npm run dev`
6. Open `http://localhost:5173`
7. Login as `alice@example.com` / `password123`
