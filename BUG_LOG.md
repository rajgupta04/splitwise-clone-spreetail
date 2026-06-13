# Bug Log

Tracks symptoms, errors, root causes, fixes, and verification details throughout development.

---

## BUG-001

* **Bug ID**: BUG-001
* **Date**: 2026-06-12
* **Module**: Prisma Setup
* **Symptoms / Issue**: Prisma Client generation failed on server setup.
* **Error Message**: `P1012: datasource url no longer supported`
* **Investigation Steps**:
  1. Ran `npx prisma generate` during initial backend setup.
  2. Observed P1012 syntax verification error on datasource configuration.
  3. Inspected `package.json` dependencies and noticed Prisma version 7 had been installed.
* **Root Cause**: The project template was developed for Prisma 6, but default npm package installs pulled Prisma 7.x which deprecated specific datasource configurations.
* **Fix Applied**: Downgraded both `prisma` and `@prisma/client` to `6.9.0` in `package.json` and ran `npm install`.
* **Verification Method**: Ran `npx prisma generate` successfully without compiler errors.
* **Status**: Resolved

---

## BUG-002

* **Bug ID**: BUG-002
* **Date**: 2026-06-12
* **Module**: Prisma Client Build
* **Symptoms / Issue**: Running database schema updates or client generations failed due to system lock errors.
* **Error Message**: `EPERM: operation not permitted, rename '...\node_modules\.prisma\client\query_engine-windows.dll.node.tmp' -> '...\node_modules\.prisma\client\query_engine-windows.dll.node'`
* **Investigation Steps**:
  1. Tried executing `npx prisma generate` while the local development server was active.
  2. Observed that the process failed when trying to overwrite the client binary.
  3. Identified that the active Node process was holding a file lock on the query engine binary.
* **Root Cause**: On Windows, the OS blocks overwriting active binary files (`.dll` / `.node`) currently loaded by running Node.js server processes.
* **Fix Applied**: Stopped the background development server (nodemon) before running client generations, then restarted it.
* **Verification Method**: Verified that Prisma generate compiles successfully without permission errors.
* **Status**: Resolved

---

## BUG-003

* **Bug ID**: BUG-003
* **Date**: 2026-06-13
* **Module**: Balances, Memberships
* **Symptoms / Issue**: Balance calculations and membership validity queries failed, crashing the request pipeline.
* **Error Message**: `ERROR: operator does not exist: text = uuid`
* **Investigation Steps**:
  1. Inspected actual PostgreSQL schema and compared it with the Prisma models.
  2. Discovered that Prisma `String` fields without explicit `@db.Uuid` annotations map to `TEXT` columns in PostgreSQL.
  3. Noticed raw SQL query templates cast variables using `::uuid`.
  4. Observed that Prisma's `$queryRaw` engine automatically infers UUID-formatted strings as `UUID` variables at compile time.
* **Root Cause**: Operator mismatch. Comparing a `TEXT` column to a `UUID` parameter directly in PostgreSQL causes a runtime crash as implicit casting does not exist.
* **Fix Applied**: Added explicit `::text` type casting (e.g. `${groupId}::text`) inside raw SQL queries to override Prisma's auto-inference.
* **Verification Method**: Verified that all balance and membership endpoints complete correctly.
* **Status**: Resolved

---

## BUG-004

* **Bug ID**: BUG-004
* **Date**: 2026-06-13
* **Module**: Expenses
* **Symptoms / Issue**: Fetching paginated expense listings failed when query parameters were present.
* **Error Message**: `PrismaClientValidationError: Argument take: Invalid value provided. Expected Int, provided String.`
* **Investigation Steps**:
  1. Traced input variables from the Express controller down to the Prisma model call.
  2. Checked query string values inside Express `req.query` and confirmed they are parsed as strings.
* **Root Cause**: Prisma expects strict integer parameters for database pagination offsets and takes (`skip`, `take`), but received raw strings from HTTP requests.
* **Fix Applied**: Sanitized incoming pagination variables using `parseInt(..., 10)` in both the Express controller boundary and defensively in the repository layer.
* **Verification Method**: Tested list endpoints with page and limit queries (e.g. `?page=2&limit=5`) successfully.
* **Status**: Resolved

---

## BUG-005

* **Bug ID**: BUG-005
* **Date**: 2026-06-12
* **Module**: Groups Module
* **Symptoms / Issue**: Newly created groups were not queryable on the group details page, returning 404 errors until the backend server was restarted.
* **Error Message**: `Error: Group not found`
* **Investigation Steps**:
  1. Successfully created a group and verified its presence in the database.
  2. Queried the group by ID and observed a 404 response.
  3. Noticed that the GET route worked only after restarting the server.
  4. Identified that the repository loaded database objects into an in-memory startup cache rather than making direct database requests.
* **Root Cause**: Stale memory cache. The repository queried a static in-memory array populated once during startup instead of executing queries against the live PostgreSQL database.
* **Fix Applied**: Refactored the service and repository to query the database using the Prisma Client client on every request, removing the stale startup cache.
* **Verification Method**: Checked that groups are instantly queryable immediately after creation.
* **Status**: Resolved

---

## BUG-006

* **Bug ID**: BUG-006
* **Date**: 2026-06-13
* **Module**: Memberships, Expenses
* **Symptoms / Issue**: Expense creation failed with validation errors for users who joined the group on the same day.
* **Error Message**: `The payer was not a member of this group on the expense date.`
* **Investigation Steps**:
  1. Inspected schema types; `group_memberships.joined_at` is a timezone-aware `TIMESTAMP WITH TIME ZONE` (defaulting to the current time), while `expenses.expense_date` is a date-only `DATE` column.
  2. Traced how JavaScript parses input strings like `"2025-02-01"` to UTC midnight (`00:00:00Z`).
  3. Identified that PostgreSQL compared the precise join time (e.g., `07:09:03Z`) against UTC midnight (`00:00:00Z`), resulting in a false evaluation.
* **Root Cause**: Timestamp vs Date comparison bug. Comparing a precise timestamp (with a time-of-day component) to a midnight-normalized UTC representation of a date-only field fails when they occur on the same day.
* **Fix Applied**: Applied PostgreSQL `::date` casts to both the database columns (`joined_at` and `left_at`) and the passed JS Date parameters inside `isMemberOnDate` and `getActiveMembersOnDate` queries to force calendar-day checks.
* **Verification Method**: Verified that same-day group joining and expense log validation succeeds.
* **Status**: Resolved

---

## BUG-007

* **Bug ID**: BUG-007
* **Date**: 2026-06-13
* **Module**: Prisma Seeding
* **Symptoms / Issue**: Running the database seed command wipes out all active data, transaction history, and upload tables.
* **Error Message**: None (Silent data loss).
* **Investigation Steps**:
  1. Ran the seed command and observed that all previous user accounts and balances were wiped.
  2. Audited the seed script and found that it executes `deleteMany` calls on all models on execution.
* **Root Cause**: The seeding file was programmed to perform an aggressive cleanup (`deleteMany({})` on all models) to ensure a clean slate, without warnings or checks to see if there was existing user-created data.
* **Fix Applied**: Updated script documentation, added console warning outputs, and guarded the cleanup blocks to prevent execution in production environments.
* **Verification Method**: Verified that warnings print during execution and production checks prevent data loss.
* **Status**: Resolved

---

## BUG-008

* **Bug ID**: BUG-008
* **Date**: 2026-06-13
* **Module**: Frontend Currency UX
* **Symptoms / Issue**: Add Expense form and Settlement form displayed exchange rate inputs even when the currency matched the group's base currency, causing user confusion.
* **Error Message**: None (UX Issue).
* **Investigation Steps**:
  1. Reviewed `GroupDetailPage.jsx` modals for expense and settlement creation.
  2. Noticed the exchange rate field was partially conditional but poorly rendered.
  3. Identified lack of real-time fetching when foreign currencies were selected.
* **Root Cause**: Frontend modals lacked API integration with the backend `CurrencyService` to auto-fetch rates and conditionally render the conversion preview based on the exact currency match.
* **Fix Applied**: Exposed `GET /api/currency/rate`, added `currencyApi` to frontend, implemented `useEffect` to auto-fetch rates, conditionally hide the rate field when `expenseCurrency == baseCurrency`, and display real-time converted amounts when they differ.
* **Verification Method**: UI tests confirm exchange rate hides on exact match and auto-fetches/previews on foreign currency selection.
* **Status**: Resolved

---

## BUG-009

* **Bug ID**: BUG-009
* **Date**: 2026-06-13
* **Module**: Imports
* **Symptoms / Issue**: Import finalization throws a 400 error about unreviewed items even when the user has approved or rejected all flagged items.
* **Error Message**: `X items have not been reviewed yet. Please decide on all items before finalizing.`
* **Investigation Steps**:
  1. Traced `finalizeImport` logic and discovered `clean` items were evaluated as `undecided`.
  2. Confirmed that items without anomalies start as `clean` and the UI does not prompt users to approve them.
* **Root Cause**: The filter for `undecided` items assumed all valid terminal states were either `approved`, `rejected`, or `error`, inadvertently categorizing `clean` items as unreviewed blockers.
* **Fix Applied**: Updated `finalizeImport` to explicitly include `clean` items within the `approved` execution list and bypass the undecided check.
* **Verification Method**: Ran trace simulations and confirmed `clean` items are successfully imported.
* **Status**: Resolved

---

## BUG-010

* **Bug ID**: BUG-010
* **Date**: 2026-06-13
* **Module**: Imports
* **Symptoms / Issue**: Rows with missing or unmatched payers are silently dropped during import, resulting in fewer expenses than expected.
* **Error Message**: None (Silent data loss).
* **Investigation Steps**:
  1. Simulated a finalization process with database records.
  2. Noticed that rows with `paidByUserId === null` hit a `continue` statement inside the finalization loop, aborting creation without warning.
* **Root Cause**: The loop was engineered to silently skip rows missing critical fields to avoid database transaction crashes, rather than explicitly failing the row and recording a terminal error state.
* **Fix Applied**: Replaced the silent `continue` with a database update that transitions the item's status to `failed` and records a `FINALIZATION_ERROR` anomaly flag.
* **Verification Method**: Verified via test scripts that unmatched payers yield a `failed` item status instead of disappearing.
* **Status**: Resolved

---

## BUG-011

* **Bug ID**: BUG-011
* **Date**: 2026-06-13
* **Module**: Imports
* **Symptoms / Issue**: Rows with zero recognized participants are silently skipped.
* **Error Message**: None (Silent data loss).
* **Investigation Steps**:
  1. Traced split calculation logic inside `finalizeImport`.
  2. Discovered that if `participants.length === 0`, a `continue` executes.
* **Root Cause**: Similar to BUG-010, the pipeline swallowed invalid split arrays to prevent division-by-zero crashes but failed to report the rejection.
* **Fix Applied**: Integrated explicit error transitions (`failed` status) and `FINALIZATION_ERROR` anomaly generation prior to the loop continuation.
* **Verification Method**: Code audit confirms all silent `continue` pathways are eliminated.
* **Status**: Resolved
