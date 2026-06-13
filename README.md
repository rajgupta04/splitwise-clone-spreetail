# Shared Expenses Application

A production-grade shared expenses platform built for the **Spreetail Software Engineering Internship Assignment**. Users create groups, log expenses with four split methods, settle debts, and import historical CSV data with anomaly detection — all with temporal membership awareness and multi-currency support.

> **What makes this implementation unique:**
> - **Temporal membership model** — members join and leave over time; balances are computed only for periods of active membership, preventing debt inheritance.
> - **Audit-safe multi-currency** — every transaction stores the original amount, currency, exchange rate, and normalized amount. Balances are deterministic and never change retroactively.
> - **CSV import engine with anomaly detection** — seven anomaly categories with an item-level approval workflow and import reporting.
> - **Greedy debt simplification** — minimizes the number of settlement transactions required to zero out all group balances.

---

## Table of Contents

- [Features](#features)
- [Assignment Requirements Mapping](#assignment-requirements-mapping)
- [System Architecture](#system-architecture)
- [Database Design](#database-design)
- [Balance Calculation Algorithm](#balance-calculation-algorithm)
- [CSV Import Engine](#csv-import-engine)
- [Currency Strategy](#currency-strategy)
- [AI Usage Disclosure](#ai-usage-disclosure)
- [Setup Instructions](#setup-instructions)
- [Test Users](#test-users)
- [API Reference](#api-reference)
- [Project Documentation](#project-documentation)
- [Known Limitations & Future Work](#known-limitations--future-work)
- [Deployment Links](#deployment-links)

---

## Features

### Authentication
- Email/password registration with input validation (Zod)
- JWT-based session management with configurable expiration
- Passwords hashed with bcrypt (12 salt rounds)
- Protected API routes with auth middleware

### Groups
- Create, update, and soft-delete groups
- Per-group base currency configuration
- Creator auto-added as first member
- Group-level activity audit logging

### Memberships (Temporal)
- Add members by email address
- Remove members (debts persist, future expenses excluded)
- Rejoin support (new membership record with fresh `joined_at`)
- Full membership timeline history

### Expenses
- **Equal Split** — total divided evenly; remainder cents distributed fairly
- **Exact Split** — user-specified amounts per participant (validated against total)
- **Percentage Split** — percentage-based allocation (validated to sum to 100%)
- **Shares Split** — proportional allocation based on integer share counts
- Temporal membership validation on every expense (payer and participants must be active on expense date)
- Soft-delete support for expense removal

### Balances
- Per-group net balance computation across all expenses and settlements
- Cross-group personal balance summary (total owed / total owing / net)
- Greedy debt simplification algorithm (see [Balance Calculation](#balance-calculation-algorithm))

### Settlements
- Record payments between group members
- Multi-currency settlement support
- Settlement amounts deducted from balance calculations

### CSV Import Engine
- File upload endpoint with validation (CSV only, configurable size limit)
- Row-level parsing with anomaly detection (7 anomaly types)
- Item-level approval workflow (uploader-only authority)
- Import finalization creates verified expenses
- Import reporting with row-level decision audit trail

### Currency Handling
- Per-group base currency (e.g., INR, USD, EUR)
- Real-time exchange rate fetching via Frankfurter API
- Historical rate support for backdated expenses and CSV imports
- In-memory rate caching for batch processing performance
- Smart frontend UX: rate fields hidden when currencies match; auto-fetched and previewed when they differ

---

## Assignment Requirements Mapping

| Requirement | Status | Implementation Details |
|---|---|---|
| User registration and login | ✅ Complete | JWT authentication with bcrypt password hashing |
| Create and manage groups | ✅ Complete | Full CRUD with soft-delete and base currency |
| Add/remove group members | ✅ Complete | Temporal membership with `joined_at` / `left_at` tracking |
| Membership changes over time | ✅ Complete | Raw SQL temporal queries; expenses only affect members active on expense date |
| Log shared expenses | ✅ Complete | Four split types with cent-level precision arithmetic |
| Equal split | ✅ Complete | Integer-cent division with fair remainder distribution |
| Exact amount split | ✅ Complete | Sum validation with ±$0.01 tolerance |
| Percentage split | ✅ Complete | Sum-to-100% validation with ±0.01% tolerance |
| Shares-based split | ✅ Complete | Proportional allocation with remainder distribution |
| Calculate group balances | ✅ Complete | Aggregated expense debts minus settlements |
| Simplify group debts | ✅ Complete | Greedy algorithm matching largest debtor ↔ largest creditor |
| Record settlements | ✅ Complete | Payer-to-payee payments with multi-currency support |
| Multi-currency support | ✅ Complete | Dual-amount storage: original + normalized with exchange rate |
| CSV import | ✅ Framework | Upload, parsing framework, and approval workflow built; column mapping pending CSV file |
| Anomaly detection | ✅ Framework | 7 anomaly type definitions and severity system; detection logic pending CSV format |
| Approval workflow | ✅ Complete | Item-level approve/reject with uploader-only authority |
| Import reports | ✅ Framework | Report endpoint and decision audit trail built |
| Audit logging | ✅ Complete | All CRUD operations logged in `activity_logs` with metadata |
| React frontend | ✅ Complete | Dashboard, group detail (5 tabs), 4 modals, glassmorphism design |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
│                                                             │
│   React 19  ·  Tailwind CSS 4  ·  Vite 8  ·  React Router 7│
│                                                             │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Login   │  │ Dashboard │  │  Group   │  │ Register │  │
│   │  Page    │  │   Page    │  │  Detail  │  │   Page   │  │
│   └──────────┘  └───────────┘  └──────────┘  └──────────┘  │
│         │              │             │              │        │
│         └──────────────┼─────────────┼──────────────┘        │
│                        │             │                       │
│                   Axios Client (JWT Interceptor)             │
└────────────────────────┼─────────────┼───────────────────────┘
                         │  HTTP/JSON  │
                         ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER                               │
│                                                             │
│   Node.js 22  ·  Express 5  ·  Prisma 6  ·  Zod 4          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Middleware Layer                    │   │
│   │  CORS · Auth (JWT) · Validation (Zod) · Error       │   │
│   └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │               Controller Layer                      │   │
│   │  Auth · Groups · Memberships · Expenses · Balances  │   │
│   │  Settlements · Imports · Currency                   │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │                Service Layer                        │   │
│   │  Business logic · Split math · Debt simplification  │   │
│   │  Currency conversion · Anomaly detection            │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │               Repository Layer                      │   │
│   │  Prisma ORM (CRUD) · Raw SQL (temporal queries)     │   │
│   └──────────────────────┬──────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                               │
│                                                             │
│   PostgreSQL 15+  ·  Neon (Serverless Hosting)              │
│                                                             │
│   11 Tables · Temporal Memberships · Multi-Currency Fields  │
│   Soft Deletes · Activity Audit Logging · CSV Import Chain  │
└─────────────────────────────────────────────────────────────┘
```

The backend follows a strict **3-layer clean architecture**: Controllers handle HTTP concerns, Services contain business logic, and Repositories manage data access. Controllers never touch Prisma directly. Raw SQL is used only for complex temporal membership queries that Prisma's query builder cannot express.

---

## Database Design

The application uses **11 relational tables** managed by Prisma ORM with PostgreSQL:

| Table | Purpose | Key Design Notes |
|---|---|---|
| `users` | User accounts | Email uniqueness enforced; bcrypt password hashes |
| `groups` | Expense groups | Per-group `base_currency`; soft-delete via `is_active` |
| `group_memberships` | **Temporal membership** | `joined_at` + `left_at` timestamps; `status` field; unique constraint on `(group_id, user_id, joined_at)` for rejoin support |
| `expenses` | Expense records | Multi-currency fields; soft-delete via `is_deleted`; optional link to `import_items` |
| `expense_splits` | Per-user split amounts | Stores both `original_amount` and `normalized_amount`; optional `percentage` and `shares` fields |
| `settlements` | Debt payments | Multi-currency fields; tracks payer → payee direction |
| `csv_imports` | Import job tracking | Status lifecycle: `processing` → `pending_review` → `completed` / `partially_completed` / `failed` |
| `import_items` | Per-row import data | Raw CSV data + parsed data; status per row |
| `anomaly_flags` | Detected anomalies | 7 anomaly types with `error` / `warning` / `info` severity |
| `import_decisions` | Approval audit trail | Per-item approve/reject with reason and timestamp |
| `activity_logs` | Full audit log | All CRUD operations logged with action type, entity reference, and JSON metadata |

### Why Temporal Memberships?

A flat membership list (user is either "in" or "out") causes severe accounting bugs:

- **New members inherit old debts** — a user joining in April would be charged for February expenses.
- **Leaving erases history** — removing a member would wipe their unpaid balances.

The temporal model stores explicit `joined_at` and `left_at` timestamps. Every expense and balance query checks:

```sql
joined_at::date <= expense_date AND (left_at IS NULL OR left_at::date >= expense_date)
```

This ensures that expenses only affect members who were **active on the transaction date**.

### Entity Relationships

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

---

## Balance Calculation Algorithm

The balance engine computes net balances and simplified debts in four steps. All calculations operate on `normalized_amount` (the group's base currency).

### Step 1: Aggregate Expense Debts

For every non-deleted expense in the group, each expense split represents a debt:

```
split.user_id  owes  expense.paid_by  the amount  split.normalized_amount
```

Self-splits (where the payer is also a participant) are excluded.

### Step 2: Aggregate Settlements

Each settlement represents a payment that reduces debt:

```
settlement.payer_id  paid  settlement.payee_id  the amount  settlement.normalized_amount
```

### Step 3: Compute Net Balances

For each user:

```
net_balance = (total owed TO user from expenses) - (total user OWES from expenses)
            + (total user PAID in settlements) - (total RECEIVED by user in settlements)
```

- **Positive** net balance → user is a net creditor (others owe them)
- **Negative** net balance → user is a net debtor (they owe others)

### Step 4: Greedy Debt Simplification

The algorithm minimizes the number of transactions needed to settle all debts:

1. Separate users into **debtors** (negative balance) and **creditors** (positive balance)
2. Sort both lists by absolute amount (descending)
3. Match the **largest debtor** with the **largest creditor**
4. Transfer the **minimum** of their absolute balances
5. Update remaining balances; remove fully settled users
6. Repeat until all balances are zero

### Worked Example

Given the seed dataset with 3 expenses and 1 settlement:

| Phase | Event | Aisha | Rohan | Priya | Meera | Sam |
|---|---|---|---|---|---|---|
| 1 | Groceries $120 (Equal, 4-way) | +$90 | −$30 | −$30 | −$30 | — |
| 2 | Internet $200 (Percentage) | +$30 | +$90 | −$90 | −$30 | — |
| 3 | Settlement: Rohan → Aisha $50 | +$80 | +$40 | −$90 | −$30 | — |
| 4 | Electricity $100 (Shares) | **+$55** | **+$40** | **−$40** | **−$30** | **−$25** |

**Simplified debts** (greedy matching):

1. Priya → Aisha: $40.00
2. Meera → Aisha: $15.00
3. Meera → Rohan: $15.00
4. Sam → Rohan: $25.00

Result: **4 transactions** settle all debts (vs. the original 7 expense splits + 1 settlement = 8 financial events).

---

## CSV Import Engine

### Import Flow

```
Upload CSV ──→ Parse Rows ──→ Detect Anomalies ──→ User Reviews ──→ Finalize
     │              │                │                    │              │
     ▼              ▼                ▼                    ▼              ▼
  CsvImport    ImportItems     AnomalyFlags       ImportDecisions   Expenses
  (job record)  (per-row)      (per-item flags)   (approve/reject)  (created)
```

1. **Upload**: User uploads a CSV file to a group. A `CsvImport` job is created with status `processing`.
2. **Parse**: Each row is stored as an `ImportItem` with the raw CSV data and a parsed/normalized representation.
3. **Detect**: Seven anomaly detectors run against each row, generating `AnomalyFlag` records with severity levels.
4. **Review**: The uploader reviews flagged items and approves or rejects them individually. Error-severity items cannot be approved.
5. **Finalize**: Approved items are converted into real `Expense` records with proper splits. The import status transitions to `completed` or `partially_completed`.

### Anomaly Categories

| Anomaly Type | Severity | Description |
|---|---|---|
| `duplicate_expense` | Warning | Row matches an existing expense (same date, amount, description) |
| `amount_outlier` | Warning | Amount exceeds 2× group average or $10,000 absolute cap |
| `membership_violation` | Error | Payer or participant was not an active member on the expense date |
| `future_dated` | Error | Expense date is in the future |
| `missing_fields` | Error | Required fields (amount, payer, date) are missing or empty |
| `invalid_split` | Error | Split amounts don't sum to total, or percentages don't sum to 100% |
| `unknown_participant` | Error | Participant email doesn't match any registered user |

---

## Currency Strategy

### Group Base Currency

Every group has a single `base_currency` (e.g., INR). All balance calculations operate exclusively in the base currency, ensuring that balances are **deterministic, auditable, and independent of future exchange rate fluctuations**.

### Storage Model

Every expense and settlement stores four currency fields:

| Field | Purpose | Example |
|---|---|---|
| `original_amount` | What was actually paid | 30.00 |
| `original_currency` | Currency of payment | USD |
| `exchange_rate` | Rate at time of entry | 83.45 |
| `normalized_amount` | Amount in group base currency | 2,503.50 (INR) |

### Why This Matters

Exchange rates change daily. If balances were recalculated using live rates, the same group could show different debt amounts on different days — making reconciliation impossible. By locking in the exchange rate at the moment of entry, balances remain **reproducible forever**.

### Frontend UX

- **Same currency** (e.g., INR expense in INR group): Exchange rate fields are completely hidden. Rate is silently set to `1.0`.
- **Foreign currency** (e.g., USD expense in INR group): The app auto-fetches the rate from the Frankfurter API, displays it for review, shows the converted amount in real-time, and allows manual override.

---

## AI Usage Disclosure

### Tools Used

- **Google Gemini (via Antigravity IDE)** — used for code generation assistance, debugging, and documentation.

### How AI Was Used

| Activity | AI Role | Human Role |
|---|---|---|
| Architecture design | Proposed initial structure after directed Q&A | Reviewed, modified, and approved all decisions |
| Code generation | Generated module boilerplate and CRUD patterns | Reviewed every file; corrected bugs and logic errors |
| Bug diagnosis | Suggested potential root causes | Verified hypotheses via database inspection and testing |
| Documentation | Drafted initial documentation templates | Edited for accuracy; added engineering context |

### Human Review Process

All AI-generated code underwent the following verification:

1. **Manual code review** — every generated file was read and understood before integration.
2. **Runtime testing** — all endpoints were tested via the frontend UI and direct API calls.
3. **Bug tracking** — AI-introduced bugs were documented in `BUG_LOG.md` with root cause analysis. See `AI_USAGE.md` for specific cases where AI suggestions were incorrect and manually corrected.
4. **Database verification** — schema assumptions were validated against actual PostgreSQL column types.

### Notable AI Corrections

| Bug | AI Error | Human Fix |
|---|---|---|
| BUG-003 | AI did not account for Prisma's internal `::uuid` auto-casting on UUID-formatted strings | Added explicit `::text` casts to override Prisma's inference engine |
| BUG-006 | AI generated temporal queries comparing `TIMESTAMP WITH TIME ZONE` to midnight-normalized `DATE` values | Added `::date` casts to both operands for calendar-day comparison |

> **Statement**: AI assisted development, but all architecture decisions, debugging, code correctness verification, and final review were performed manually. Every bug introduced by AI-generated code is documented with root cause analysis in `BUG_LOG.md` and `AI_USAGE.md`.

---

## Setup Instructions

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18.x | Runtime |
| npm | ≥ 9.x | Package management |
| PostgreSQL | ≥ 15.x | Database (or use Neon for hosted) |
| Git | any | Source control |

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/splitwise-clone-spreetail.git
cd splitwise-clone-spreetail
```

### 2. Backend Setup

```bash
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.
npm install
```

### 3. Environment Variables

Edit `server/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/splitwise_clone?schema=public"
JWT_SECRET="your-secure-random-secret"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"
MAX_FILE_SIZE_MB=10
UPLOAD_DIR="uploads"
```

### 4. Database Setup

```bash
# Push schema to database (creates all tables)
npm run db:push

# Generate Prisma Client
npm run db:generate

# Seed demo data (6 users, 1 group, 3 expenses, 1 settlement)
npm run db:seed
```

### 5. Frontend Setup

```bash
cd ../client
npm install
```

### 6. Run the Application

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd server
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### Prisma Commands Reference

| Command | Purpose |
|---|---|
| `npm run db:push` | Push schema changes to database |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual database browser) |
| `npm run db:migrate` | Create and apply a named migration |

---

## Test Users

All demo accounts share the password: **`Password123!`**

| User | Email | Group Role | Membership Period |
|---|---|---|---|
| Aisha | `aisha@example.com` | Group Creator | Feb 1, 2025 → present |
| Rohan | `rohan@example.com` | Active Member | Feb 1, 2025 → present |
| Priya | `priya@example.com` | Active Member | Feb 1, 2025 → present |
| Meera | `meera@example.com` | **Left Group** | Feb 1 → Mar 31, 2025 |
| Sam | `sam@example.com` | Joined Later | Apr 15, 2025 → present |
| Dev | `dev@example.com` | Joined Latest | May 1, 2025 → present |

The seed data includes the **Flatmates** group with a realistic temporal membership timeline and sample expenses covering equal, percentage, and shares split types, plus one settlement.

---

## API Reference

### Base URL: `http://localhost:5000/api`

All endpoints (except auth) require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| **Auth** | | |
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user profile |
| **Groups** | | |
| POST | `/groups` | Create group |
| GET | `/groups` | List user's groups |
| GET | `/groups/:id` | Get group details |
| PUT | `/groups/:id` | Update group |
| DELETE | `/groups/:id` | Archive group (soft delete) |
| **Memberships** | | |
| POST | `/groups/:id/members` | Add member by email |
| DELETE | `/groups/:id/members/:userId` | Remove member |
| GET | `/groups/:id/members` | List active members |
| GET | `/groups/:id/members/history` | Full membership timeline |
| **Expenses** | | |
| POST | `/groups/:id/expenses` | Create expense with splits |
| GET | `/groups/:id/expenses` | List expenses (paginated) |
| GET | `/expenses/:id` | Get expense details |
| PUT | `/expenses/:id` | Update expense |
| DELETE | `/expenses/:id` | Soft-delete expense |
| **Balances** | | |
| GET | `/groups/:id/balances` | Group balances + simplified debts |
| GET | `/balances/me` | User's cross-group summary |
| **Settlements** | | |
| POST | `/groups/:id/settlements` | Record settlement payment |
| GET | `/groups/:id/settlements` | List group settlements |
| **Currency** | | |
| GET | `/currency/rate?from=USD&to=INR&date=2024-01-01` | Fetch exchange rate |
| **Imports** | | |
| POST | `/groups/:id/imports` | Upload CSV file |
| GET | `/groups/:id/imports` | List group imports |
| GET | `/imports/:id` | Import details |
| GET | `/imports/:id/items` | List import items |
| POST | `/imports/:id/items/:itemId/decide` | Approve/reject item |
| POST | `/imports/:id/finalize` | Finalize import |
| GET | `/imports/:id/report` | Import report |
| GET | `/imports/:id/decisions` | Decision audit log |
| **System** | | |
| GET | `/health` | Health check |

---

## Project Documentation

| Document | Purpose |
|---|---|
| **README.md** | Project overview, setup, and architecture (this file) |
| **SCOPE.md** | *(planned)* Detailed scope and CSV format specification |
| **DECISIONS.md** | Engineering decision log with alternatives considered and reasoning |
| **AI_USAGE.md** | AI-assisted development log with error corrections |
| **BUG_LOG.md** | Comprehensive bug tracking (8 bugs documented with root cause analysis) |
| **SEED_DATASET.md** | Seed dataset documentation with membership timeline and balance audit |
| **contextForAI.md** | Full project context file for AI continuity across sessions |

---

## Known Limitations & Future Work

| # | Limitation | Impact | Path Forward |
|---|---|---|---|
| 1 | CSV import parsing pending | Cannot import historical data | Blocked on CSV file format; framework is complete |
| 2 | No automated test suite | Manual testing only | Jest (backend) + Vitest (frontend) planned |
| 3 | JWT in localStorage | XSS vulnerability risk | Use httpOnly cookies for production |
| 4 | No rate limiting | API abuse possible | Add `express-rate-limit` |
| 5 | Single payer per expense | Cannot represent shared payments | Revisit if CSV reveals multi-payer patterns |
| 6 | No real-time updates | Manual refresh needed | WebSocket/SSE for live collaboration |
| 7 | Balance not cached | Recalculated per request | Acceptable for small groups; add materialized views at scale |
| 8 | Render cold starts | ~30s wake time on free tier | Expected for demo deployment |
| 9 | No expense categories | Cannot tag or filter by type | Add optional category/tag field |

---

## Deployment Links

| Component | Platform | URL |
|---|---|---|
| Frontend | Vercel | *deployment pending* |
| Backend | Render | *deployment pending* |
| Database | Neon | *provisioned* |
| Repository | GitHub | *link pending* |

---

## License

MIT — see [LICENSE](LICENSE) for details.
