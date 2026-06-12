# Splitwise Clone - Spreetail Assignment — AI Context File

> **Purpose**: Single source of truth for the project. Enables seamless continuation across AI tools, accounts, and sessions.
> **Last Updated**: 2026-06-12 (All design decisions finalized, awaiting CSV analysis)

---

## Current Project Status

- **Phase**: Pre-Implementation — Awaiting CSV analysis
- **Completed Stages**:
  - [x] Requirement Analysis — all design questions answered
  - [x] Architecture Design — 3-layer clean architecture, feature-based modules
  - [x] Database Design — 11-table Prisma schema with multi-currency + temporal membership
  - [x] API Design — 30 endpoints designed
  - [x] Anomaly Detection Design — 7 types confirmed, severity levels defined
- **Blocked On**:
  - [ ] CSV Analysis — `expenses_export.csv` not yet provided
  - [ ] Anomaly Catalogue — depends on CSV analysis
  - [ ] Final Import Workflow — depends on CSV analysis
- **Not Started**:
  - [ ] Implementation (blocked until CSV analysis + approval)

---

## Decisions Made

### Confirmed by User (Final)

| # | Decision | Details | Date |
|---|----------|---------|------|
| D1 | **ORM** | Prisma ORM for schema, migrations, CRUD. Raw SQL only for temporal membership queries if Prisma is insufficient. | 2026-06-12 |
| D2 | **Multi-currency** | Required. Store `original_amount`, `original_currency`, `exchange_rate`, `normalized_amount`. Use normalized values for balance calculations. Preserve originals for audit. | 2026-06-12 |
| D3 | **Anomaly types** | 7 types confirmed: `duplicate_expense`, `amount_outlier`, `membership_violation`, `future_dated`, `missing_fields`, `invalid_split`, `unknown_participant` | 2026-06-12 |
| D4 | **Approval authority** | Uploader only. Any anomaly that modifies, removes, merges, or transforms imported data requires uploader approval. | 2026-06-12 |
| D5 | **Frontend** | React + Tailwind CSS | 2026-06-12 |
| D6 | **Backend** | Node.js + Express | 2026-06-12 |
| D7 | **Database** | PostgreSQL (Neon) | 2026-06-12 |
| D8 | **Deployment** | Vercel (frontend), Render (backend), Neon (PostgreSQL) | 2026-06-12 |
| D9 | **Group roles** | Flat membership. All members have same permissions. No admin/member distinction. Reason: assignment focuses on expense logic and imports, not authorization complexity. | 2026-06-12 |
| D10 | **Expense audit logging** | Maintain audit logs for all expense create/update/delete operations. Required for anomaly review and debugging import decisions. | 2026-06-12 |
| D11 | **Member leaves group** | Outstanding debts persist after leaving. Historical expenses remain valid. Future expenses after `left_at` do not affect former members. | 2026-06-12 |
| D12 | **Split types** | Equal, Exact Amount, Percentage, Shares. Additional split types discovered during CSV analysis should be added dynamically. | 2026-06-12 |
| D13 | **Multiple payers** | Single payer per expense initially. Revisit if CSV reveals multi-payer expenses. | 2026-06-12 |
| D14 | **Conversion rate strategy** | BOTH: (1) Manual exchange rate entry during import. (2) Optional API fetch as convenience. Importer must never depend on external API — historical data must be reproducible. Persist exchange rate with every imported expense. | 2026-06-12 |
| D15 | **CSV format** | Pending until `expenses_export.csv` is analyzed. | 2026-06-12 |
| D16 | **CSV columns** | Pending until `expenses_export.csv` is analyzed. | 2026-06-12 |

### Confirmed Recommendations (User-Approved Defaults)

| # | Decision | Details | Date |
|---|----------|---------|------|
| R1 | **Auth type** | Email/password with JWT (httpOnly cookies) | 2026-06-12 |
| R2 | **Email verification** | Skip (not core to assignment) | 2026-06-12 |
| R3 | **Password reset** | Skip (not core to assignment) | 2026-06-12 |
| R4 | **Rejoin after leaving** | Allowed (creates new membership record with new `joined_at`) | 2026-06-12 |
| R5 | **Group deletion** | Soft delete (archive via `is_active` flag) | 2026-06-12 |
| R6 | **Backdating expenses** | Allowed (`expense_date` can differ from `created_at`) | 2026-06-12 |
| R7 | **Expense deletion** | Soft delete with `is_deleted` flag, preserves audit trail | 2026-06-12 |
| R8 | **Partial import failure** | Import valid rows, flag invalid ones for review | 2026-06-12 |
| R9 | **Outlier threshold** | Flag if amount > 2× group average OR > configurable absolute cap | 2026-06-12 |
| R10 | **Approval granularity** | Item-level approve/reject (not batch-level) | 2026-06-12 |
| R11 | **Architecture** | 3-layer (Controller → Service → Repository), feature-based modules | 2026-06-12 |
| R12 | **Primary keys** | UUIDs | 2026-06-12 |
| R13 | **Group base currency** | Per-group base currency (configurable, default USD) | 2026-06-12 |

---

## Database State

### Schema Status: DESIGNED (not yet created)

**ORM**: Prisma
**Database**: PostgreSQL (Neon)
**Tables**: 11 tables designed

| Table | Purpose | Multi-currency |
|-------|---------|---------------|
| `users` | User accounts | N/A |
| `groups` | Expense groups with base currency | Has `base_currency` |
| `group_memberships` | Temporal membership records (`joined_at`/`left_at`) | N/A |
| `expenses` | Expense records with audit support | Yes — `original_amount`, `original_currency`, `exchange_rate`, `normalized_amount` |
| `expense_splits` | Per-participant split amounts | Yes — `original_amount`, `normalized_amount` |
| `settlements` | Debt payment records | Yes — `original_amount`, `original_currency`, `exchange_rate`, `normalized_amount` |
| `csv_imports` | Import batch records | N/A |
| `import_items` | Individual CSV rows | N/A |
| `anomaly_flags` | Anomaly detection results (7 types) | N/A |
| `import_decisions` | Approval/rejection audit trail | N/A |
| `activity_logs` | System-wide activity/decision logging for all CRUD operations | N/A |

### Key Schema Design Decisions

1. **Temporal membership**: `group_memberships` uses `joined_at`/`left_at` timestamps. Multiple records per user per group (rejoin support). Only one active record per user per group at a time.
2. **Multi-currency**: Expenses, splits, and settlements store `original_currency`, `original_amount`, `exchange_rate`, and `normalized_amount`. Balance calculations use normalized amounts only.
3. **Per-group base currency**: Each group has a `base_currency` field. All normalized amounts are expressed in this currency.
4. **Soft deletes**: Expenses use `is_deleted` flag. Groups use `is_active` flag.
5. **Split storage**: Both input (shares/percentage) AND calculated normalized amount stored. Avoids recomputation, preserves audit trail.
6. **Activity logging**: All expense CRUD operations logged in `activity_logs` table with user, action, entity reference, and metadata (old/new values).
7. **Exchange rate persistence**: Every expense and settlement stores the exchange rate used at time of creation. Imported historical data is reproducible regardless of current exchange rates.

---

## API State

### Implemented Endpoints

_None — awaiting CSV analysis before implementation begins._

### Pending Endpoints (Designed)

| Category | Count | Status |
|----------|-------|--------|
| Auth | 3 | Designed |
| Groups | 5 | Designed |
| Memberships | 4 | Designed |
| Expenses | 5 | Designed |
| Balances | 2 | Designed |
| Settlements | 2 | Designed |
| CSV Import & Approval | 6 | Designed |
| Reports | 1 | Designed |
| Decision Logs | 2 | Designed |
| **Total** | **30** | **Designed** |

---

## Folder Structure

```
splitwise-clone-spreetail/
├── .git/
├── LICENSE
├── README.md
└── contextForAI.md
```

_Planned monorepo structure (client/ + server/) documented in implementation plan. Not yet created._

---

## Business Rules

### Confirmed Rules

1. **Membership-aware balances**: Expenses only affect members who were active at the time of the expense (`expense_date` checked against `joined_at`/`left_at`).
2. **Debts persist after leaving**: A member who leaves still owes/is owed their historical debts. Future expenses after `left_at` do not affect them.
3. **Single payer per expense**: Each expense has exactly one payer. Revisit if CSV reveals multi-payer format.
4. **Split validation**: Split amounts/percentages/shares must sum to the total expense amount.
5. **Uploader approval required**: Any CSV import anomaly that modifies, removes, merges, or transforms data must be approved by the uploader only.
6. **Multi-currency normalization**: Balances always calculated using `normalized_amount` in the group's `base_currency`.
7. **Exchange rate reproducibility**: Importer never depends on external API. Exchange rate persisted with every expense. Historical data reproducible.
8. **Audit trail**: All expense create/update/delete operations are logged with timestamp, user, action, and metadata.
9. **Extensible split types**: New split types discovered during CSV analysis should be added to the system.
10. **Flat permissions**: All group members have equal permissions. No admin/member distinction.

---

## Anomaly Policies

### Confirmed Anomaly Types (7)

| # | Type | Severity | Description |
|---|------|----------|-------------|
| 1 | `duplicate_expense` | warning | Same amount + date + description + payer as existing expense |
| 2 | `amount_outlier` | warning | Amount > 2× group average OR > configurable absolute cap |
| 3 | `membership_violation` | warning | Expense date outside participant's active membership period |
| 4 | `future_dated` | warning | Expense date is in the future |
| 5 | `missing_fields` | error | Required CSV columns are empty |
| 6 | `invalid_split` | error | Split amounts/percentages don't add up to the total |
| 7 | `unknown_participant` | error | CSV references a user not in the group |

### Severity Levels

- **error**: Cannot be imported even if approved (data integrity issue)
- **warning**: Can be imported if explicitly approved by uploader
- **info**: Informational, auto-approved

### Approval Policy

- Only the **uploader** has approval authority
- Approval is at the **individual item level** (not batch)
- Every decision (approve/reject) is logged with timestamp, user ID, and reason
- Items with `error` severity cannot be approved — they must be fixed in the CSV and re-imported

---

## Pending Tasks

1. [x] Requirement Analysis
2. [x] Architecture Design
3. [x] Database Design
4. [x] API Design
5. [/] **CSV Analysis** — awaiting `expenses_export.csv` file
6. [ ] Anomaly Catalogue — depends on CSV analysis
7. [ ] Final Import Workflow — depends on CSV analysis
8. [ ] contextForAI.md update after CSV analysis
9. [ ] Authentication Module
10. [ ] Group Management Module
11. [ ] Expense Module
12. [ ] Settlement Module
13. [ ] CSV Import Engine
14. [ ] Anomaly Detection System
15. [ ] Approval Workflow
16. [ ] Balance Calculation Engine
17. [ ] Frontend Development
18. [ ] Testing
19. [ ] Deployment

---

## Risks

| Risk | Severity | Notes |
|------|----------|-------|
| CSV format undefined | **High** | `expenses_export.csv` not yet provided; blocks import engine, anomaly catalogue, and final workflow |
| Multi-currency conversion rates | Low | Resolved: manual entry + optional API fetch; exchange rate persisted |
| Prisma limitations for temporal queries | Low | Fallback to raw SQL approved |
| CSV may reveal multi-payer expenses | Medium | Design supports single payer; may need schema change |
| CSV may reveal new split types | Medium | System designed to be extensible; may need schema + validation changes |

---

## Next Recommended Step

**CSV Analysis** — The user must provide `expenses_export.csv`. Once received:

1. Parse and analyze the CSV structure (columns, data types, patterns)
2. Identify all split types present in the data
3. Produce an anomaly catalogue (what anomalies exist in this specific file)
4. Design the final import workflow based on actual data
5. Update this file
6. Get approval, then begin implementation

---

## Handoff Summary

This is a **Splitwise-inspired expense-sharing application** for a Spreetail Software Engineering Internship. 

**Tech stack**: React + Tailwind (frontend), Node.js + Express + Prisma (backend), PostgreSQL on Neon (database). Deployed to Vercel (FE) + Render (BE).

**All design decisions are finalized**:
- Multi-currency with exchange rate persistence and reproducibility
- Temporal group memberships with `joined_at`/`left_at`
- 7 confirmed anomaly types with severity levels
- Uploader-only, item-level approval workflow
- Full audit logging for expense CRUD operations
- Prisma ORM with raw SQL fallback for temporal queries
- 3-layer clean architecture with feature-based modules
- 11-table database schema designed
- 30 API endpoints designed

**Current blocker**: `expenses_export.csv` file has not been provided. This blocks CSV analysis, anomaly catalogue, final import workflow, and implementation start.

**To continue**: Provide the CSV file → Analyze it → Produce anomaly catalogue → Finalize import workflow → Update this file → Begin implementation.
