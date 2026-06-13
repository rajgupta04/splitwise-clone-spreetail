# CSV Analysis Report: `Expenses Export.csv`

> **Purpose**: Complete forensic analysis of the provided CSV before building the import engine.
> **File**: `Expenses Export.csv` (44 lines: 1 header + 43 data rows)
> **Encoding**: Windows line endings (`\r\n`)

---

## 1. Column Structure

| # | Column Name | Description | Data Type |
|---|---|---|---|
| 1 | `date` | Expense date | String (DD-MM-YYYY, but inconsistent) |
| 2 | `description` | Expense description | String |
| 3 | `paid_by` | Name of payer | String (inconsistent casing/format) |
| 4 | `amount` | Transaction amount | Number (with formatting issues) |
| 5 | `currency` | Currency code | String (sometimes missing) |
| 6 | `split_type` | How the expense is divided | String: `equal`, `unequal`, `percentage`, `share` |
| 7 | `split_with` | Participants (semicolon-delimited) | String |
| 8 | `split_details` | Split breakdown (semicolon-delimited) | String (optional, depends on split type) |
| 9 | `notes` | Free-text comments | String (optional) |

---

## 2. Participants Identified

### Core Flatmates (from assignment context)

| Name | CSV Variations Found | Role |
|---|---|---|
| **Aisha** | `Aisha` | Original flatmate, group creator |
| **Rohan** | `Rohan`, `rohan ` (lowercase, trailing space — Row 27) | Original flatmate |
| **Priya** | `Priya`, `priya` (lowercase — Row 9), `Priya S` (with suffix — Row 11) | Original flatmate |
| **Meera** | `Meera` | Original flatmate, moves out end of March |
| **Dev** | `Dev` | Joins for Goa trip |
| **Sam** | `Sam` | Moves in mid-April |

### Non-Registered Participant

| Name | Row | Context |
|---|---|---|
| **Dev's friend Kabir** | Row 23 | `Aisha;Rohan;Priya;Dev;Dev's friend Kabir` — parasailing, "Kabir joined for the day" |

> **Anomaly**: Kabir is not a registered user or group member. The importer must decide: skip this participant, or flag it?

---

## 3. Currencies

| Currency | Row Count | Rows |
|---|---|---|
| **INR** | 36 rows | Most rows |
| **USD** | 4 rows | Rows 20, 21, 23, 26 (Goa trip international bookings) |
| **Missing** | 1 row | Row 28 — `Groceries DMart` has empty currency field |

> **Note**: All USD expenses occur during the Goa trip (Mar 8-14). This maps to Priya's complaint: *"The sheet pretends a dollar is a rupee."*

---

## 4. Split Types Found

| Split Type | CSV Value | Our System Mapping | Rows |
|---|---|---|---|
| Equal | `equal` | `equal` | Majority of rows |
| Unequal / Exact Amount | `unequal` | `exact` | Row 12 |
| Percentage | `percentage` | `percentage` | Rows 15, 32 |
| Shares | `share` | `shares` | Rows 22, 35 |
| Missing / Empty | `` (empty) | ??? | Row 14 (settlement) |
| Conflicting | `equal` but `split_details` has shares data | ??? | Row 42 |

> **Note**: The CSV uses `unequal` and `share` (singular). Our system uses `exact` and `shares` (plural). The parser must map these.

---

## 5. Anomalies Detected (Row-by-Row Analysis)

### ANOMALY 1: Duplicate Expense — Rows 5 & 6
**Type**: `duplicate_expense`
**Severity**: Warning

| Field | Row 5 | Row 6 |
|---|---|---|
| Date | 08-02-2026 | 08-02-2026 |
| Description | `Dinner at Marina Bites` | `dinner - marina bites` |
| Paid By | Dev | Dev |
| Amount | 3200 | 3200 |

Same date, same payer, same amount. Descriptions differ slightly in casing and formatting. Note from Row 5 says "Dev visiting for the weekend". Row 6 has no note — likely an accidental re-entry.

**Policy Decision Required**: Which row wins? Keep Row 5 (has note), flag Row 6 as duplicate.

---

### ANOMALY 2: Comma-Formatted Number — Row 7
**Type**: `format_error` (parse issue)
**Severity**: Warning

```
amount: "1,200"
```

The amount contains a comma as thousands separator. It is CSV-quoted (`"1,200"`), so it won't break CSV parsing, but the value must be cleaned to `1200` before storing.

---

### ANOMALY 3: Inconsistent Payer Name (Lowercase) — Row 9
**Type**: `name_mismatch`
**Severity**: Warning

```
paid_by: "priya" (lowercase)
```

All other rows use `Priya` (title case). The importer must normalize names to match registered users.

---

### ANOMALY 4: Fractional Amount (3 Decimal Places) — Row 10
**Type**: `rounding_issue`
**Severity**: Warning

```
amount: 899.995
```

Our schema uses `Decimal(12,2)` — two decimal places. This value has **three** decimal places and cannot be stored exactly. Must round: `900.00` (nearest cent) or `899.99` (truncate).

---

### ANOMALY 5: Payer Name With Suffix — Row 11
**Type**: `name_mismatch`
**Severity**: Warning

```
paid_by: "Priya S"
```

No user named "Priya S" exists. This is likely "Priya" with an accidental surname initial. Must fuzzy-match to `Priya`.

---

### ANOMALY 6: Unequal Split Amounts Don't Sum to Total — Row 12
**Type**: `invalid_split`
**Severity**: Error

```
amount: 1500
split_details: "Rohan 700; Priya 400; Meera 400"
sum(splits) = 700 + 400 + 400 = 1500 ✓
```

Wait — this actually DOES sum correctly. But the split type is `unequal`, which our system calls `exact`. This is a **mapping issue**, not an invalid split. Let me re-check...

Actually: amounts 700 + 400 + 400 = **1500** ✓. This is valid. The anomaly here is the **split type name** (`unequal` → must map to `exact`).

---

### ANOMALY 7: Missing Payer — Row 13
**Type**: `missing_fields`
**Severity**: Error

```
paid_by: "" (empty)
description: "House cleaning supplies"
notes: "can't remember who paid"
```

A transaction with no payer. Cannot create an expense without knowing who paid.

---

### ANOMALY 8: Settlement Logged as Expense — Row 14
**Type**: `settlement_as_expense`
**Severity**: Warning (requires special handling)

```
description: "Rohan paid Aisha back"
paid_by: Rohan
split_with: Aisha
split_type: "" (empty)
notes: "this is a settlement not an expense??"
```

The user themselves flagged this as a settlement. The importer should **not** create an expense — it should create a **Settlement** record (Rohan → Aisha, ₹5000).

---

### ANOMALY 9: Percentage Split Doesn't Sum to 100% — Row 15
**Type**: `invalid_split`
**Severity**: Warning

```
split_details: "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
sum = 30 + 30 + 30 + 20 = 110%
notes: "percentages might be off"
```

The percentages sum to **110%**, not 100%. The user's own note acknowledges this. The importer must decide how to handle: reject, normalize to 100%, or flag for manual review.

---

### ANOMALY 10: Duplicate Expense (Different Amounts) — Rows 24 & 25
**Type**: `duplicate_expense`
**Severity**: Warning

| Field | Row 24 | Row 25 |
|---|---|---|
| Date | 11-03-2026 | 11-03-2026 |
| Description | `Dinner at Thalassa` | `Thalassa dinner` |
| Paid By | Aisha | Rohan |
| Amount | 2400 | 2450 |

Note on Row 25: *"Aisha also logged this I think hers is wrong"*

Same dinner, logged by two different people with different amounts. Which amount is correct? Rohan's note suggests Aisha's is wrong. 

**Policy Decision Required**: Keep Row 25 (Rohan, 2450), reject Row 24 (Aisha, 2400)?

---

### ANOMALY 11: Negative Amount (Refund) — Row 26
**Type**: `negative_amount` / `refund`
**Severity**: Warning

```
description: "Parasailing refund"
amount: -30
currency: USD
notes: "one slot got cancelled"
```

Is a negative amount an error or a refund? Context says "refund" explicitly. The importer should treat this as a legitimate credit/refund transaction (reduces the debt from the original parasailing expense).

---

### ANOMALY 12: Malformed Date — Row 27
**Type**: `invalid_date`
**Severity**: Error

```
date: "Mar-14"
```

All other rows use `DD-MM-YYYY` format. This row uses `Mon-DD` format with **no year**. Must infer the year from context (likely 2026, since it's between March and April entries).

Additionally, `paid_by: "rohan "` has a trailing space.

---

### ANOMALY 13: Missing Currency — Row 28
**Type**: `missing_fields`
**Severity**: Warning

```
currency: "" (empty)
notes: "forgot to set currency"
```

No currency specified. Given the group is INR-based and all surrounding rows are INR, the importer should assume INR — but flag it.

---

### ANOMALY 14: Zero Amount — Row 31
**Type**: `zero_amount`
**Severity**: Warning

```
description: "Dinner order Swiggy"
amount: 0
notes: "counted twice earlier - fixing later"
```

An expense with amount 0. The user's note says it was "counted twice earlier" — this appears to be a placeholder/correction row that should be skipped entirely.

---

### ANOMALY 15: Unknown Participant — Row 23
**Type**: `unknown_participant`
**Severity**: Error

```
split_with: "Aisha;Rohan;Priya;Dev;Dev's friend Kabir"
```

`Dev's friend Kabir` is not a registered user. The importer must either skip this participant (and recalculate the split), or reject the row.

---

### ANOMALY 16: Ambiguous Date Format — Row 34
**Type**: `ambiguous_date`
**Severity**: Warning

```
date: "04-05-2026"
notes: "is this April 5 or May 4? format is a mess"
```

Using `DD-MM-YYYY` convention (consistent with all other rows), this is **May 4, 2026**. But the note asks if it's April 5. The user is confused by their own date format. Given that the CSV header row uses DD-MM consistently, we should parse as **04 May 2026** — but flag the ambiguity.

Additionally, this date is **after** the last April row (01-04-2026 to 20-04-2026), which would place it out of chronological order if interpreted as April 5, but correctly in sequence if May 4.

---

### ANOMALY 17: Membership Violation (Post-Departure Expense) — Row 36
**Type**: `membership_violation`
**Severity**: Warning

```
date: 02-04-2026
split_with: "Aisha;Rohan;Priya;Meera"
notes: "oops Meera still in the group list"
```

Meera moved out at end of March (farewell dinner is Row 33, dated 28-03-2026). This April expense still includes Meera as a participant. The user's own note acknowledges the mistake.

**This directly addresses Sam's concern**: *"I moved in mid-April. Why would March electricity affect my balance?"* — temporal membership awareness must prevent this.

---

### ANOMALY 18: Settlement Disguised as Equal Split — Row 38
**Type**: `settlement_as_expense`
**Severity**: Warning

```
description: "Sam deposit share"
paid_by: Sam
amount: 15000
split_with: Aisha
notes: "Sam moving in! paid Aisha his deposit"
```

This is Sam paying Aisha a security deposit — a transfer between two people, not a group expense. Should likely be treated as a settlement (Sam → Aisha, ₹15000) rather than an expense.

---

### ANOMALY 19: Conflicting Split Type vs Split Details — Row 42
**Type**: `conflicting_split_data`
**Severity**: Warning

```
split_type: "equal"
split_details: "Aisha 1; Rohan 1; Priya 1; Sam 1"
notes: "split_type says equal but someone added shares anyway"
```

The `split_type` says `equal` but `split_details` contains shares data. Since all shares are equal (1:1:1:1), the result is the same either way. The importer should use the `equal` type and ignore the redundant share details — but flag the inconsistency.

---

## 6. Anomaly Summary Table

| # | Row | Anomaly Type | Severity | Description |
|---|---|---|---|---|
| A1 | 5-6 | `duplicate_expense` | Warning | Marina Bites dinner logged twice (same payer, amount, date) |
| A2 | 7 | `format_error` | Warning | Amount has comma thousands separator (`"1,200"`) |
| A3 | 9 | `name_mismatch` | Warning | Payer `priya` (lowercase) instead of `Priya` |
| A4 | 10 | `rounding_issue` | Warning | Amount `899.995` has 3 decimal places |
| A5 | 11 | `name_mismatch` | Warning | Payer `Priya S` instead of `Priya` |
| A6 | 12 | `split_type_mapping` | Info | Split type `unequal` must be mapped to `exact` |
| A7 | 13 | `missing_fields` | Error | Missing payer (`paid_by` is empty) |
| A8 | 14 | `settlement_as_expense` | Warning | Settlement logged as expense (Rohan→Aisha ₹5000) |
| A9 | 15 | `invalid_split` | Warning | Percentages sum to 110%, not 100% |
| A10 | 24-25 | `duplicate_expense` | Warning | Thalassa dinner logged by two people with different amounts |
| A11 | 26 | `negative_amount` | Warning | Negative amount (−$30 refund) |
| A12 | 27 | `invalid_date` | Error | Date format `Mar-14` instead of DD-MM-YYYY; no year |
| A13 | 28 | `missing_fields` | Warning | Missing currency |
| A14 | 31 | `zero_amount` | Warning | Amount is 0; user note says "counted twice earlier" |
| A15 | 23 | `unknown_participant` | Error | `Dev's friend Kabir` is not a registered user |
| A16 | 34 | `ambiguous_date` | Warning | `04-05-2026` — is it Apr 5 or May 4? |
| A17 | 36 | `membership_violation` | Warning | Meera included in April expense after moving out |
| A18 | 38 | `settlement_as_expense` | Warning | Sam's deposit to Aisha logged as expense |
| A19 | 42 | `conflicting_split_data` | Warning | `split_type` says equal but `split_details` has shares |

**Total: 19 anomalies across 43 data rows** (the assignment said "at least 12")

---

## 7. Split Type Mapping

| CSV Value | Our System Value | Notes |
|---|---|---|
| `equal` | `equal` | Direct match |
| `unequal` | `exact` | Rename; amounts are specified per participant |
| `percentage` | `percentage` | Direct match |
| `share` | `shares` | Rename (singular → plural) |
| `` (empty) | N/A | Settlement row (Row 14) or error |

---

## 8. Date Format Analysis

| Format | Row Count | Examples |
|---|---|---|
| `DD-MM-YYYY` | 41 rows | `01-02-2026`, `08-03-2026` |
| `Mon-DD` | 1 row | `Mar-14` (Row 27) |
| Ambiguous | 1 row | `04-05-2026` (Row 34) |

The dominant format is **DD-MM-YYYY**. The parser should use this as the canonical format and flag deviations.

---

## 9. Chronological Timeline

| Period | Events | Members Active |
|---|---|---|
| Feb 2026 | Rows 2-15: Regular flatmate expenses | Aisha, Rohan, Priya, Meera |
| Early Mar | Rows 16-18: Regular expenses | Aisha, Rohan, Priya, Meera |
| Mar 8-14 | Rows 19-27: **Goa trip** (USD expenses, Dev joins) | Aisha, Rohan, Priya, Dev |
| Late Mar | Rows 28-33: Regular expenses, Meera farewell | Aisha, Rohan, Priya, Meera |
| Apr 2026 | Rows 35-43: Post-Meera, Sam moves in | Aisha, Rohan, Priya, Sam |
| May 2026? | Row 34: Ambiguous date | Aisha, Rohan, Priya |

---

## 10. Key Design Decisions Required Before Implementation

| # | Question Raised by CSV | Options |
|---|---|---|
| 1 | How to handle duplicate expenses? | Auto-reject second, flag both for review, or keep both |
| 2 | How to handle negative amounts (refunds)? | Treat as legitimate credit, reject, or convert to separate refund type |
| 3 | How to handle settlement rows? | Auto-detect and create Settlement records instead of Expenses |
| 4 | How to handle missing payer? | Reject row (error), or flag for user assignment |
| 5 | How to handle percentage sums ≠ 100%? | Reject, normalize proportionally, or flag |
| 6 | How to handle unknown participants (Kabir)? | Skip participant and recalculate, or reject row |
| 7 | How to handle post-departure membership violations? | Remove departed member and recalculate, or flag |
| 8 | How to handle zero-amount rows? | Auto-skip, or flag |
| 9 | How to handle ambiguous dates? | Parse as DD-MM-YYYY consistently, flag the ambiguity |
| 10 | How to handle comma-formatted numbers? | Strip commas silently, or flag |
| 11 | How to handle name variations? | Fuzzy match to registered users, flag unmatched |
| 12 | How to handle conflicting split_type vs split_details? | Prefer split_type, ignore redundant details, flag |
