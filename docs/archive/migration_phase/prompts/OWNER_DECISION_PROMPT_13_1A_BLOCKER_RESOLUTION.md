# OWNER DECISION — PROMPT 13.1A BLOCKER RESOLUTION

## Document Control

**Parent Stage:** Prompt 13.1 — Runtime Migration Preflight & Execution Readiness  
**Decision Stage:** Prompt 13.1A — Blocker Analysis & Owner Decision  
**Decision Date:** September 20, 2026  
**Decision Authority:** Project Owner  
**Status:** APPROVED / BINDING FOR PROMPT 13.1B  
**Next Authorized Stage:** Prompt 13.1B — Authorized Blocker Resolution, Backup & Re-Preflight

---

# 1. OWNER DECISION SUMMARY

Following review of the Prompt 13.1A Blocker Analysis & Owner Decision Packet, the Project Owner approves:

### ODR-13.1A-01 — `order_items` Precision Treatment

**APPROVED: OPTION B — PRE-MIGRATION LIVE SCHEMA ALIGNMENT**

### ODR-13.1A-02 — Physical Backup & Sequencing

**APPROVED: CREATE AND VERIFY PHYSICAL BACKUP BEFORE ANY LIVE SCHEMA MUTATION**

These decisions authorize only the narrow blocker-resolution scope defined below.

They do NOT authorize Expand migration execution.

---

# 2. ODR-13.1A-01 — `order_items` PRECISION TREATMENT

## Decision

The Project Owner authorizes the targeted pre-migration schema alignment of the two existing legacy `order_items` columns to the already-approved Target Database Schema / Prisma contract.

### Authorized target definitions

```text
order_items.cost_price
    Current:  NUMERIC(12,2) NOT NULL
    Target:   NUMERIC(15,4) NOT NULL / DEFAULT 0

order_items.discount_amount
    Current:  NUMERIC(12,2) NOT NULL DEFAULT 0
    Target:   NUMERIC(15,2) NOT NULL DEFAULT 0
```

### Authorized live DDL scope

Antigravity is authorized to execute only the following targeted schema alignment against `pos_db`:

```sql
ALTER TABLE "order_items"
  ALTER COLUMN "cost_price" TYPE NUMERIC(15, 4),
  ALTER COLUMN "cost_price" SET DEFAULT 0,
  ALTER COLUMN "discount_amount" TYPE NUMERIC(15, 2),
  ALTER COLUMN "discount_amount" SET DEFAULT 0;
```

## Scope restrictions

The authorization covers only:

- `order_items.cost_price`
- `order_items.discount_amount`

No other table, column, index, constraint, enum, sequence, function, trigger, or application code may be changed under this decision.

## Migration artifact restriction

Do NOT modify:

- `migration.sql`
- `rollback.sql`
- Target Schema Revision 4
- Prisma schema

The approved target contract remains authoritative.

## Data safety requirement

Before executing the DDL:

- verify current `order_items` row count;
- verify current column definitions;
- verify current database identity;
- verify the required physical backup has already been created and integrity-checked.

The currently known state is `order_items = 0 rows`, but this must be re-verified immediately before mutation.

If the live state differs from the expected state, STOP and request Owner Review.

---

# 3. ODR-13.1A-02 — PHYSICAL BACKUP AUTHORIZATION

## Decision

The Project Owner authorizes creation and verification of a full custom-format PostgreSQL backup of `pos_db` before any live schema mutation.

### Backup method

Use PostgreSQL custom format:

```bash
pg_dump -Fc -h localhost -U postgres -d pos_db -f <approved_backup_path>
```

The backup path must be explicit and recorded in the evidence artifact.

## Required verification

The backup must satisfy all of the following before any live `ALTER TABLE`:

1. `pg_dump` exits successfully (`exit code 0`).
2. Backup file exists.
3. Backup file is non-zero in size.
4. Archive contents can be inspected successfully using a non-mutating command such as:

```bash
pg_restore --list <approved_backup_path>
```

5. Backup metadata/contents correspond to the intended `pos_db`.
6. Backup timestamp is recorded.
7. Backup integrity evidence is recorded.

## Restore rule

Do NOT restore the backup over real `pos_db`.

A restore drill, if required later, must use a separate disposable database and a separately authorized process.

---

# 4. MANDATORY SAFETY SEQUENCE

The following order is binding:

```text
1. Verify Owner Decision
          ↓
2. Re-verify live `pos_db` state
          ↓
3. Create physical backup
          ↓
4. Verify backup integrity
          ↓
5. Re-verify `order_items` state / row count
          ↓
6. Execute ONLY the authorized `order_items` alignment
          ↓
7. Validate resulting schema
          ↓
8. Re-run Prompt 13.1 full runtime preflight
          ↓
9. Produce final gate
          ↓
10. STOP
```

### Absolute rule

**NO LIVE DDL BEFORE VERIFIED BACKUP.**

A rollback SQL script is not a substitute for the physical backup requirement.

---

# 5. REQUIRED POST-RESOLUTION VALIDATION

After the authorized `order_items` alignment:

Verify:

### `order_items.cost_price`

- type = numeric
- precision = 15
- scale = 4
- expected nullability retained
- default = 0

### `order_items.discount_amount`

- type = numeric
- precision = 15
- scale = 2
- expected nullability retained
- default = 0

### Data

- row count;
- existing values, if any;
- no unrelated data modification.

### Migration readiness

Re-run the full Prompt 13.1 preflight.

Do NOT execute Expand during this stage.

---

# 6. AUTHORIZATION BOUNDARY

This Owner Decision authorizes:

- physical backup creation;
- backup verification;
- the specific `order_items` schema alignment described above;
- post-change validation;
- full Prompt 13.1 re-preflight.

This Owner Decision does NOT authorize:

- Expand migration;
- `prisma migrate deploy`;
- migration lifecycle execution;
- Backfill;
- Dual-write;
- Cutover;
- Contract;
- Prompt 13.2;
- any unrelated database or application changes.

---

# 7. FAIL-CLOSED CONDITIONS

Antigravity MUST STOP and return:

**BLOCKED / OWNER REVIEW REQUIRED**

if any of these occurs:

- backup creation fails;
- backup verification fails;
- database identity differs from the authorized target;
- `order_items` contains unexpected rows or schema state;
- the authorized DDL would require additional unapproved changes;
- migration.sql / rollback.sql would need modification to proceed;
- unexpected schema drift is discovered;
- any unrelated mutation would be required;
- Prompt 13.1 re-preflight still has a safety-critical blocker.

No implicit approval is granted for additional changes.

---

# 8. OWNER DECISION RECORD

| Decision ID | Decision | Status |
|---|---|---|
| ODR-13.1A-01 | Approve Option B: align `order_items` precision to Target Schema before Expand | **APPROVED** |
| ODR-13.1A-02 | Approve physical `pg_dump -Fc` backup and mandatory verification before live DDL | **APPROVED** |

---

# 9. FINAL OWNER INSTRUCTION

Antigravity is authorized to proceed to:

**PROMPT 13.1B — AUTHORIZED BLOCKER RESOLUTION, BACKUP & RE-PREFLIGHT**

using only the scope and sequencing approved in this decision.

After Prompt 13.1B completes:

**STOP.**

Do not execute Expand or Prompt 13.2.

---

# 10. EXPLICIT OWNER STATEMENT

I approve:

> **OPTION B** for the `order_items` precision mismatch, and  
> **physical backup + verification before any live schema mutation**.

The approved schema alignment is limited to:

```text
cost_price       NUMERIC(12,2) → NUMERIC(15,4) DEFAULT 0
discount_amount  NUMERIC(12,2) → NUMERIC(15,2) DEFAULT 0
```

No other migration or application action is authorized by this decision.
