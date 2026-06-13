# SCOPE.md — Anomaly Log & Database Schema

> **Purpose**: Documents every data problem found in `Expenses Export.csv`, the detection rules used, handling policies chosen, and the database schema.
> **See also**: [CSV_ANALYSIS.md](CSV_ANALYSIS.md) for raw forensic analysis, [DECISIONS.md](DECISIONS.md) for architectural reasoning.

---

## Part 1: Anomaly Catalog

### ANOM-001 — Duplicate Expense (Identical)

- **Rows**: 5 & 6
- **Description**: "Dinner at Marina Bites" and "dinner - marina bites" — same date (08-02-2026), same payer (Dev), same amount (₹3,200). Row 5 has a note; Row 6 does not.
- **Detection Rule**: Same date + same payer + same amount + fuzzy description match (normalized lowercase, stripped punctuation, Levenshtein distance or substring overlap).
- **Handling Policy**: Flag the later row (Row 6) as a duplicate. Mark as `warning` severity. Auto-reject the duplicate, keep the one with more context (notes).
- **User Approval Required?**: Yes — user can override and keep both if intentional.

---

### ANOM-002 — Comma-Formatted Number

- **Row**: 7
- **Description**: Amount field contains `"1,200"` — a comma as thousands separator inside a quoted CSV value.
- **Detection Rule**: Amount string contains non-numeric characters other than `.` and `-` after stripping quotes.
- **Handling Policy**: Silently strip commas and parse as `1200`. Flag as `info` severity so the user sees it was cleaned.
- **User Approval Required?**: No — automatic fix, shown in report.

---

### ANOM-003 — Payer Name Case Mismatch

- **Row**: 9
- **Description**: `paid_by` is `priya` (lowercase) instead of `Priya`.
- **Detection Rule**: Case-insensitive match against registered users where exact match fails but `.toLowerCase()` match succeeds.
- **Handling Policy**: Auto-resolve to the correctly-cased registered user name. Flag as `info` severity.
- **User Approval Required?**: No — automatic normalization.

---

### ANOM-004 — Fractional Amount (3+ Decimal Places)

- **Row**: 10
- **Description**: Amount is `899.995` — three decimal places. Our schema stores `Decimal(12,2)`.
- **Detection Rule**: Parsed amount has more than 2 decimal places.
- **Handling Policy**: Round to nearest cent using banker's rounding: `899.995` → `₹900.00`. Flag as `warning` severity.
- **User Approval Required?**: Yes — user should confirm the rounded value is acceptable.

---

### ANOM-005 — Payer Name With Suffix

- **Row**: 11
- **Description**: `paid_by` is `Priya S` — not an exact match to any registered user.
- **Detection Rule**: Exact user lookup fails → attempt fuzzy match (first name match, prefix match, edit distance ≤ 2).
- **Handling Policy**: If a confident fuzzy match is found (e.g., `Priya S` → `Priya`), auto-resolve and flag as `warning`. If no match, flag as `error`.
- **User Approval Required?**: Yes — user confirms the name mapping.

---

### ANOM-006 — Unmapped Split Type

- **Row**: 12 (`unequal`), Row 22 (`share`)
- **Description**: CSV uses `unequal` and `share`; our system uses `exact` and `shares`.
- **Detection Rule**: `split_type` value not in `['equal', 'exact', 'percentage', 'shares']` but matches a known alias.
- **Handling Policy**: Auto-map: `unequal` → `exact`, `share` → `shares`. Flag as `info`.
- **User Approval Required?**: No — deterministic mapping.

---

### ANOM-007 — Missing Payer

- **Row**: 13
- **Description**: `paid_by` field is empty. Note says "can't remember who paid".
- **Detection Rule**: `paid_by` field is empty or whitespace-only after trimming.
- **Handling Policy**: Flag as `error` severity. Row cannot be imported without a payer.
- **User Approval Required?**: N/A — cannot approve; must reject or fix data.

---

### ANOM-008 — Settlement Logged as Expense

- **Row**: 14
- **Description**: "Rohan paid Aisha back" — ₹5,000 from Rohan to Aisha. Empty `split_type`. User note: "this is a settlement not an expense??"
- **Detection Rule**: Heuristic combination: (a) `split_type` is empty, (b) `split_with` contains exactly one person, (c) description contains keywords like "paid back", "settlement", "reimburse", "deposit".
- **Handling Policy**: Auto-classify as a **Settlement** (not an Expense). Create a Settlement record (payer → payee) on finalization. Flag as `warning`.
- **User Approval Required?**: Yes — user confirms it should be treated as settlement.

---

### ANOM-009 — Percentage Split Sums to ≠ 100%

- **Row**: 15
- **Description**: Percentages are `30% + 30% + 30% + 20% = 110%`. User note: "percentages might be off".
- **Detection Rule**: Sum of parsed percentage values ≠ 100 (with ±0.01% tolerance).
- **Handling Policy**: Flag as `warning` severity. Do NOT auto-normalize. Present the raw percentages and the sum to the user for review.
- **User Approval Required?**: Yes — user must approve or reject. If approved, percentages will be normalized proportionally to sum to 100%.

---

### ANOM-010 — Duplicate Expense (Conflicting Amounts)

- **Rows**: 24 & 25
- **Description**: "Dinner at Thalassa" (Aisha, ₹2,400) and "Thalassa dinner" (Rohan, ₹2,450) — same date, same restaurant, different payers and amounts. Row 25 note: "Aisha also logged this I think hers is wrong".
- **Detection Rule**: Same date + overlapping participants + fuzzy description match + different amounts or payers.
- **Handling Policy**: Flag both rows as `warning`. Present them side-by-side to the user. Based on the note, default-suggest keeping Row 25 (Rohan's entry).
- **User Approval Required?**: Yes — user picks which row to keep.

---

### ANOM-011 — Negative Amount (Refund)

- **Row**: 26
- **Description**: Amount is `-30` USD. Description: "Parasailing refund". Note: "one slot got cancelled".
- **Detection Rule**: Parsed amount is < 0.
- **Handling Policy**: Treat as a legitimate **refund/credit**. The payer (Dev) receives money back, reducing the group's debt to him. Store as a negative-amount expense. Flag as `info`.
- **User Approval Required?**: Yes — user confirms it's a genuine refund, not a data entry error.

---

### ANOM-012 — Malformed Date

- **Row**: 27
- **Description**: Date is `Mar-14` — month abbreviation with no year, completely different format from the `DD-MM-YYYY` standard used everywhere else.
- **Detection Rule**: Date string does not match `DD-MM-YYYY` regex. Attempt fallback parsing (`Mon-DD`, `YYYY-MM-DD`, etc.).
- **Handling Policy**: Parse as `14-03-2026` (infer year from surrounding rows — between March and April 2026 entries). Flag as `warning`.
- **User Approval Required?**: Yes — user confirms the interpreted date.

---

### ANOM-013 — Missing Currency

- **Row**: 28
- **Description**: Currency field is empty. Note: "forgot to set currency".
- **Detection Rule**: `currency` field is empty or whitespace-only.
- **Handling Policy**: Default to group's base currency (INR). Flag as `warning`.
- **User Approval Required?**: Yes — user confirms the assumed currency.

---

### ANOM-014 — Zero Amount

- **Row**: 31
- **Description**: Amount is `0`. Note: "counted twice earlier - fixing later".
- **Detection Rule**: Parsed amount equals 0.
- **Handling Policy**: Flag as `warning`. Suggest auto-rejection since a ₹0 expense has no financial impact and the user's note indicates it was a placeholder.
- **User Approval Required?**: Yes — user confirms skip/rejection.

---

### ANOM-015 — Unknown Participant

- **Row**: 23
- **Description**: `split_with` includes `Dev's friend Kabir` — not a registered user.
- **Detection Rule**: Participant name does not match any registered user (exact or fuzzy).
- **Handling Policy**: Flag as `error` severity. The expense cannot include an unregistered participant. Options: (a) reject the row, or (b) import with only the registered participants and recalculate the split.
- **User Approval Required?**: Yes — user decides whether to exclude Kabir and re-split among 4 people, or reject the row entirely.

---

### ANOM-016 — Ambiguous Date

- **Row**: 34
- **Description**: Date is `04-05-2026`. In DD-MM-YYYY format this is May 4. But the note says: "is this April 5 or May 4? format is a mess".
- **Detection Rule**: Date where day ≤ 12 and month ≤ 12 (both could be day or month). Combined with: date falls outside the chronological sequence of surrounding rows.
- **Handling Policy**: Parse as DD-MM-YYYY consistently (May 4, 2026). Flag as `warning` with both interpretations shown.
- **User Approval Required?**: Yes — user confirms correct interpretation.

---

### ANOM-017 — Membership Violation (Post-Departure)

- **Row**: 36
- **Description**: Meera included in an April 2 expense, but she moved out at end of March (farewell dinner on Mar 28). Note: "oops Meera still in the group list".
- **Detection Rule**: Participant's `left_at` date is before the expense date (temporal membership check).
- **Handling Policy**: Flag as `warning`. Suggest removing Meera from participants and recalculating the equal split among the remaining members.
- **User Approval Required?**: Yes — user confirms Meera should be excluded.

---

### ANOM-018 — Settlement Disguised as Expense (Deposit)

- **Row**: 38
- **Description**: "Sam deposit share" — Sam paid Aisha ₹15,000. Note: "Sam moving in! paid Aisha his deposit".
- **Detection Rule**: `split_with` contains exactly one person + description contains keywords ("deposit", "paid", "transfer").
- **Handling Policy**: Auto-classify as **Settlement** (Sam → Aisha, ₹15,000). Flag as `warning`.
- **User Approval Required?**: Yes — user confirms it's a transfer, not a shared expense.

---

### ANOM-019 — Conflicting Split Type vs Split Details

- **Row**: 42
- **Description**: `split_type` is `equal` but `split_details` contains `Aisha 1; Rohan 1; Priya 1; Sam 1` (shares notation). Note: "split_type says equal but someone added shares anyway".
- **Detection Rule**: `split_type` is `equal` but `split_details` is non-empty and contains share/percentage/amount data.
- **Handling Policy**: Since all shares are equal (1:1:1:1), the result is identical to an equal split. Use `equal` type, ignore redundant details. Flag as `info`.
- **User Approval Required?**: No — result is mathematically identical.

---

## Part 2: Anomaly Summary

| ID | Type | Row(s) | Severity | Auto-Resolvable? |
|---|---|---|---|---|
| ANOM-001 | Duplicate expense (identical) | 5, 6 | Warning | No — needs approval |
| ANOM-002 | Comma-formatted number | 7 | Info | Yes |
| ANOM-003 | Payer name case mismatch | 9 | Info | Yes |
| ANOM-004 | Fractional amount (3 decimals) | 10 | Warning | No — needs approval |
| ANOM-005 | Payer name with suffix | 11 | Warning | No — needs approval |
| ANOM-006 | Unmapped split type | 12, 22 | Info | Yes |
| ANOM-007 | Missing payer | 13 | Error | No — must reject |
| ANOM-008 | Settlement logged as expense | 14 | Warning | No — needs approval |
| ANOM-009 | Percentage split ≠ 100% | 15 | Warning | No — needs approval |
| ANOM-010 | Duplicate expense (conflicting) | 24, 25 | Warning | No — needs approval |
| ANOM-011 | Negative amount (refund) | 26 | Info | No — needs approval |
| ANOM-012 | Malformed date | 27 | Warning | No — needs approval |
| ANOM-013 | Missing currency | 28 | Warning | No — needs approval |
| ANOM-014 | Zero amount | 31 | Warning | No — needs approval |
| ANOM-015 | Unknown participant | 23 | Error | No — needs approval |
| ANOM-016 | Ambiguous date | 34 | Warning | No — needs approval |
| ANOM-017 | Membership violation | 36 | Warning | No — needs approval |
| ANOM-018 | Settlement disguised as expense | 38 | Warning | No — needs approval |
| ANOM-019 | Conflicting split type vs details | 42 | Info | Yes |

**Totals**: 19 anomalies | 3 Error | 12 Warning | 4 Info

---

## Part 3: Database Schema

### Core Tables (11 total)

```
┌──────────────────┐     ┌──────────────────┐
│      users       │     │      groups       │
├──────────────────┤     ├──────────────────┤
│ id          UUID │     │ id          UUID │
│ email     UNIQUE │     │ name        TEXT │
│ name        TEXT │     │ description TEXT?│
│ password_hash    │     │ base_currency    │
│ created_at       │     │ created_by  FK   │
│ updated_at       │     │ is_active   BOOL │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────────────────────────────┐
│          group_memberships (TEMPORAL)     │
├──────────────────────────────────────────┤
│ id         UUID                          │
│ group_id   FK → groups                   │
│ user_id    FK → users                    │
│ joined_at  TIMESTAMP (default: now())    │
│ left_at    TIMESTAMP? (null = active)    │
│ status     VARCHAR(20) active/inactive   │
│ UNIQUE(group_id, user_id, joined_at)     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│         expenses (MULTI-CURRENCY)        │
├──────────────────────────────────────────┤
│ id                UUID                   │
│ group_id          FK → groups            │
│ paid_by           FK → users             │
│ description       TEXT                   │
│ original_amount   DECIMAL(12,2)          │
│ original_currency VARCHAR(3)             │
│ exchange_rate     DECIMAL(12,6) def 1.0  │
│ normalized_amount DECIMAL(12,2)          │
│ split_type        VARCHAR(20)            │
│ expense_date      DATE                   │
│ created_by        FK → users             │
│ import_item_id    FK? → import_items     │
│ is_deleted        BOOLEAN def false      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│            expense_splits                │
├──────────────────────────────────────────┤
│ id                UUID                   │
│ expense_id        FK → expenses          │
│ user_id           FK → users             │
│ original_amount   DECIMAL(12,2)          │
│ normalized_amount DECIMAL(12,2)          │
│ percentage        DECIMAL(5,2)?          │
│ shares            INT?                   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│       settlements (MULTI-CURRENCY)       │
├──────────────────────────────────────────┤
│ id                UUID                   │
│ group_id          FK → groups            │
│ payer_id          FK → users             │
│ payee_id          FK → users             │
│ original_amount   DECIMAL(12,2)          │
│ original_currency VARCHAR(3)             │
│ exchange_rate     DECIMAL(12,6) def 1.0  │
│ normalized_amount DECIMAL(12,2)          │
│ settled_at        TIMESTAMP              │
│ created_by        FK → users             │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│            csv_imports                   │
├──────────────────────────────────────────┤
│ id             UUID                      │
│ group_id       FK → groups               │
│ uploaded_by    FK → users                │
│ file_name      TEXT                      │
│ status         VARCHAR(30)               │
│   processing | pending_review |          │
│   completed | partially_completed | failed│
│ total_rows     INT                       │
│ valid_rows     INT                       │
│ flagged_rows   INT                       │
│ approved_rows  INT                       │
│ rejected_rows  INT                       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│           import_items                   │
├──────────────────────────────────────────┤
│ id           UUID                        │
│ import_id    FK → csv_imports            │
│ row_number   INT                         │
│ raw_data     JSON (original CSV row)     │
│ parsed_data  JSON? (normalized values)   │
│ status       VARCHAR(20)                 │
│   pending | clean | flagged |            │
│   approved | rejected | error            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│          anomaly_flags                   │
├──────────────────────────────────────────┤
│ id              UUID                     │
│ import_item_id  FK → import_items        │
│ anomaly_type    VARCHAR(30)              │
│ severity        VARCHAR(10) error|warning|info│
│ details         TEXT (human-readable)    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│         import_decisions                 │
├──────────────────────────────────────────┤
│ id              UUID                     │
│ import_item_id  FK → import_items        │
│ decision        VARCHAR(10) approve|reject│
│ decided_by      FK → users               │
│ reason          TEXT?                     │
│ decided_at      TIMESTAMP                │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│          activity_logs                   │
├──────────────────────────────────────────┤
│ id           UUID                        │
│ user_id      FK → users                  │
│ action       VARCHAR(50)                 │
│ entity_type  VARCHAR(20)                 │
│ entity_id    UUID                        │
│ metadata     JSON?                       │
│ created_at   TIMESTAMP                   │
└──────────────────────────────────────────┘
```

### Key Design Rationale

- **Temporal Memberships**: `joined_at` + `left_at` enables the system to know exactly who was a member on any given date. This directly addresses Sam's requirement (*"Why would March electricity affect my balance?"*) and powers ANOM-017 detection.
- **Multi-Currency Fields**: `original_amount` + `original_currency` + `exchange_rate` + `normalized_amount` preserves the audit trail while enabling consistent balance math in the group's base currency. This addresses Priya's requirement (*"The sheet pretends a dollar is a rupee."*).
- **Import Pipeline Chain**: `csv_imports` → `import_items` → `anomaly_flags` / `import_decisions` → `expenses` enables the full review workflow. This addresses Meera's requirement (*"I want to approve anything the app deletes or changes."*).
