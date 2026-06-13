# Backend Audit Log

> Tracks bugs, fixes, and lessons learned during backend development.

---

## BUG-001: `operator does not exist: text = uuid` in Balance Calculation

**Date**: 2026-06-13
**Severity**: Critical (module completely non-functional)
**Affected Module**: Balances, Memberships (all raw SQL queries)

### Symptom

All balance calculation and temporal membership queries failed with:

```
ERROR: operator does not exist: text = uuid
```

The failing comparison was between `es.user_id` (column) and `e.paid_by` (column), but the actual trigger was the `WHERE` clause comparing a `TEXT` column against a `UUID`-cast parameter.

### Root Cause

**Prisma schema type mapping mismatch.**

In `schema.prisma`, all `id` and FK fields are declared as:

```prisma
id  String  @id  @default(uuid())
```

Without the `@db.Uuid` directive, Prisma maps `String` to PostgreSQL **`TEXT`** — not `UUID`. The `@default(uuid())` only controls the default *value* generator; it does **not** set the column type.

However, all 4 raw SQL queries in the codebase cast their parameters with `::uuid`:

```sql
WHERE e.group_id = ${groupId}::uuid   -- TEXT column = UUID parameter → ERROR
```

PostgreSQL does **not** implicitly cast between `TEXT` and `UUID`, so the `=` operator fails.

### Affected Columns

All `id` and FK columns across all 11 tables are `TEXT`, not `UUID`. This includes:

| Table | Column | Prisma Type | PG Type |
|-------|--------|-------------|---------|
| `users` | `id` | `String` | `TEXT` |
| `groups` | `id`, `created_by` | `String` | `TEXT` |
| `expenses` | `id`, `group_id`, `paid_by`, `created_by` | `String` | `TEXT` |
| `expense_splits` | `id`, `expense_id`, `user_id` | `String` | `TEXT` |
| `settlements` | `id`, `group_id`, `payer_id`, `payee_id`, `created_by` | `String` | `TEXT` |
| `group_memberships` | `id`, `group_id`, `user_id` | `String` | `TEXT` |

### Fix Applied (Two-Stage)

#### Stage 1: Removed explicit `::uuid` casts (insufficient)

Initially removed `::uuid` casts from raw SQL source code. However, the error persisted because **Prisma's `$queryRaw` engine auto-detects UUID-formatted strings and adds `::uuid` parameter typing at the engine level**, regardless of what's written in the SQL template.

Evidence from Prisma query log — even with no `::uuid` in source code:
```
WHERE e.group_id = $1::uuid    ← Prisma auto-added ::uuid
```

#### Stage 2: Added explicit `::text` casts (fix)

**Added `::text` casts after each parameterized value** to override Prisma's automatic UUID inference. This forces PostgreSQL to cast the UUID-typed parameter back to TEXT before comparing with the TEXT column.

```sql
-- Before (Prisma sends as $1::uuid → TEXT = UUID → ERROR)
WHERE e.group_id = ${groupId}

-- After (Prisma sends as $1::uuid, then ::text overrides → TEXT = TEXT → OK)
WHERE e.group_id = ${groupId}::text
```

#### Files Modified

1. **`server/src/modules/balances/balances.repository.js`** — 2 queries fixed
   - `getExpenseDebts()`: `WHERE e.group_id = ${groupId}::text`
   - `getSettlementTotals()`: `WHERE group_id = ${groupId}::text`

2. **`server/src/modules/memberships/memberships.repository.js`** — 2 queries fixed
   - `isMemberOnDate()`: `WHERE group_id = ${groupId}::text AND user_id = ${userId}::text`
   - `getActiveMembersOnDate()`: `WHERE gm.group_id = ${groupId}::text`

### Alternative Considered (Not Chosen)

Adding `@db.Uuid` to all ID/FK fields in `schema.prisma` would change the PG column types from `TEXT` to `UUID`. This would:
- Require a database migration on all 11 tables
- Be a larger, riskier change
- Not be necessary since UUID-formatted strings stored in TEXT columns work correctly

### Lessons Learned

1. **Prisma `String @default(uuid())` → PostgreSQL `TEXT`, not `UUID`.** Only `String @db.Uuid` → `UUID`.

2. **Prisma `$queryRaw` auto-infers parameter types.** UUID-formatted strings are automatically cast to `::uuid` at the engine level. Simply removing `::uuid` from source code is NOT enough.

3. **Override with `::text`.** When the database column is `TEXT` but Prisma infers UUID, use `${param}::text` to explicitly downcast the parameter.

**Rule**: In Prisma `$queryRaw`, always match parameter casts to the actual column type. Use `::text` for TEXT columns, even if the values contain UUIDs.

---

## BUG-002: `PrismaClientValidationError` — `take` Expected Int, provided String

**Date**: 2026-06-13
**Severity**: Critical (expense listing non-functional)
**Affected Module**: Expenses (pagination)

### Symptom

```
PrismaClientValidationError:
Argument `take`: Invalid value provided. Expected Int, provided String.
```

### Root Cause

Express `req.query` values are **always strings**. The expenses controller passed `req.query.page` and `req.query.limit` directly to the service and repository without parsing:

```js
// Controller — passed strings
{ page: req.query.page, limit: req.query.limit }  // "1", "20"

// Repository — destructured with defaults, but defaults don't trigger for truthy strings
async findByGroupId(groupId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;  // JS coerces for arithmetic → works by accident
    // ...
    take: limit,  // "20" (string!) → Prisma rejects
}
```

### Audit Results

| Module | Uses `take`/`skip`? | Had Issue? |
|--------|---------------------|------------|
| **Expenses** | ✅ Yes (paginated list) | ✅ **Fixed** |
| Settlements | ❌ No pagination | ✅ Clean |
| Groups | ❌ No pagination | ✅ Clean |
| Imports | ❌ No pagination | ✅ Clean |
| Memberships | ❌ No pagination | ✅ Clean |
| Balances | ❌ No pagination | ✅ Clean |

### Fix Applied

**Two-layer defense:**

1. **Controller** (`expenses.controller.js` line 20-21): Parse query params to integers at the HTTP boundary:
   ```js
   const page = parseInt(req.query.page, 10) || 1;
   const limit = parseInt(req.query.limit, 10) || 20;
   ```

2. **Repository** (`expenses.repository.js` line 37-39): Defensive `parseInt` as safety net:
   ```js
   const pageInt = parseInt(page, 10) || 1;
   const limitInt = parseInt(limit, 10) || 20;
   const skip = (pageInt - 1) * limitInt;
   ```

### Lesson Learned

**Rule**: Always `parseInt` Express query parameters before passing to Prisma. `req.query.*` values are **always strings**, even when they look like numbers.
