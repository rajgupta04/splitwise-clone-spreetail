# AI Usage Log

Tracks major AI-assisted changes, suggestions, prompt context, and corrections made when the AI generated incorrect code.

---

## 1. Balances & Memberships Type Mismatch (BUG-003 / Reconstructed BUG-001)

* **Prompt Used**: 
  "Balance calculation module is failing. Error: `ERROR: operator does not exist: text = uuid`. Inspect actual PostgreSQL column types, compare schema.prisma, identify columns, and fix the raw SQL query."
* **AI Suggestion**: 
  The AI suggested that the error was caused by the explicit `::uuid` casts in the raw SQL query templates. It suggested removing those casts so that PostgreSQL would compare raw string parameters with the TEXT database columns.
* **Accepted**: Partially (initially accepted, but failed validation).
* **AI Error / Why it was wrong**: 
  The AI's suggestion was incorrect because it overlooked Prisma Client's internal parameter typing. Prisma's `$queryRaw` engine automatically scans variables, detects UUID-formatted strings, and appends `::uuid` casts at the rust-engine level before passing them to PostgreSQL. Thus, simply removing `::uuid` from the JS string templates had no effect; Prisma re-applied it.
* **Corrections Made**: 
  Added explicit `::text` casts (e.g. `${groupId}::text`) to the parameters in the raw SQL. This explicitly instructs PostgreSQL to cast the query engine's inferred UUID variable back to TEXT before executing the comparison, resolving the mismatch.

---

## 2. Pagination Parameter Validation (BUG-004 / Reconstructed BUG-002)

* **Prompt Used**: 
  "The current blocking error is: PrismaClientValidationError: Argument `take`: Invalid value provided. Expected Int, provided String in src/modules/expenses/expenses.repository.js. Audit pagination code and convert query parameters."
* **AI Suggestion**: 
  The AI suggested parsing the Express `req.query.page` and `req.query.limit` values to integers inside `expenses.controller.js` before calling the service layer, and using default fallbacks.
* **Accepted**: Yes, fully accepted.
* **Issues Found**: None.
* **Corrections Made**: 
  Added an additional defensive layer inside `expenses.repository.js` (using `parseInt` on incoming values) to prevent runtime crashes if subsequent service modules bypass the controller boundaries.

---

## 3. Same-Day Membership Validation Failure (BUG-006 / Reconstructed BUG-003)

* **Prompt Used**: 
  "Expense creation fails with: 'The payer was not a member of this group on the expense date.' Validation fails even when the user just created the group. Fix this bug now."
* **AI Suggestion**: 
  The AI suggested altering the raw SQL queries in `memberships.repository.js` to cast both the database timestamp columns (`joined_at` and `left_at`) and the passed JS Date variables to PostgreSQL `DATE` types (`::date`).
* **Accepted**: Yes, fully accepted.
* **AI Error / Why it was wrong**: 
  In the initial codebase generation phase, the AI had constructed raw SQL temporal membership range queries comparing timestamp columns (`TIMESTAMP WITH TIME ZONE`) directly to Date parameters (which default to UTC midnight). This was logically wrong as same-day joiners are added at e.g., 12:30 PM, which is chronologically after the midnight timestamp of their join date.
* **Corrections Made**: 
  Re-aligned the raw query comparison by truncating time components:
  ```sql
  joined_at::date <= ${new Date(date)}::date
  ```
  This forces calendar-day comparison rather than absolute millisecond-precision checks.


## Recent Updates (CSV Import & Personal Currency)
- **Global Personal Currency**: Added preferredCurrency to user profile, updating the Dashboard to reflect balances converted to the user's local currency using real-time mock exchange rates.
- **Mock Test Group**: Integrated a one-click Mock Test Group (INR) generator on the Import page that reads the provided sample CSV and auto-creates identical users (Aisha, Rohan, Priya, Meera, Dev) for testing.
- **Interactive Anomaly Resolution**: Upgraded the ResolutionModal to display full raw data context (Description, Amount, Paid By) for each anomaly, streamlining user decisions.
- **CSV Execution Handler**: Finalized the execution loop that commits resolved ImportItem records to the main Expense and Settlement tables.

