# PROMPT 13.3B — Backfill Worker Refactor & Reconciliation Checker Fix

## 0. CONTEXT

Owner has ratified all three Prompt 13.3 decisions:

```text
OD-13.3-01 = OPTION A
OD-13.3-02 = OPTION A
OD-13.3-03 = OPTION A

AUTHORIZE: PROMPT 13.3A OWNER DECISION
```

Therefore:

- Opening InventoryLedger calibration entries are authorized as part of the later Backfill design.
- Backfill workers shall be refactored to parameterized raw SQL and must not depend on the stale generated target Prisma delegates.
- PIN-less users shall retain `pin_hash = NULL`; no synthetic reset columns or temporary PIN generation.
- This prompt authorizes SOURCE-CODE-ONLY remediation and validation preparation.
- This prompt does NOT authorize any Backfill DML against `pos_db`.

---

# 1. OBJECTIVE

Repair the existing Backfill and reconciliation implementation so that it becomes technically capable of a safe, deterministic, read-only dry-run against the post-Expand Target Schema.

The goal is to remove the two technical blockers identified by Prompt 13.3:

1. Backfill workers depending on unavailable generated Prisma target delegates.
2. Invalid `order_items.tenant_id` reference inside `reconcile_tenant_integrity.ts`.

Also incorporate the ratified Owner Decisions into the implementation contract without executing Backfill.

---

# 2. HARD SAFETY BOUNDARY

For this prompt:

### ABSOLUTELY PROHIBITED

- Any INSERT into `pos_db`.
- Any UPDATE in `pos_db`.
- Any DELETE in `pos_db`.
- Any TRUNCATE in `pos_db`.
- Any ALTER/DROP/CREATE on `pos_db`.
- Any Backfill execution against `pos_db`.
- Any live migration execution.
- Any Prisma `generate` that replaces the application-facing generated client.
- Any application runtime modernization outside migration/reconciliation code.
- Any modification to protected legacy data.

### ALLOWED

- Read repository source files.
- Edit Backfill source files.
- Edit reconciliation source files.
- Add helper modules/tests for migration code.
- Run TypeScript compile/type checks for migration sources.
- Run static searches.
- Run tests that do not mutate `pos_db`.
- Run isolated/disposable test databases only when explicitly created for test purposes and clearly isolated from `pos_db`.

The application must remain OFFLINE / quiescent.

---

# 3. AUTHORITATIVE SOURCES

Before editing code, inspect and reconcile against:

1. `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
2. `/docs/validation/10_PROMPT_12_BACKFILL_DESIGN.md`
3. `/docs/validation/09_MIGRATION_READINESS_REPORT.md`
4. `/docs/validation/15_PROMPT_13_2B_ENUM_TRANSITION_EXECUTION_FINAL_REPORT.md`
5. `/docs/validation/15_PROMPT_13_2C_EXPAND_RETRY_EXECUTION_FINAL_REPORT.md`
6. `/docs/validation/16_PROMPT_13_3_BACKFILL_RECONCILIATION_AND_EXECUTION_READINESS.md`
7. `/server/prisma/schema.prisma`
8. `/server/src/migrations/backfill/*.ts`
9. `/server/src/migrations/reconciliation/*.ts`

Source-of-truth hierarchy remains:

1. Existing source code + live DB facts
2. Approved Architecture Decisions
3. Approved Target Data Architecture
4. Approved Migration Design
5. This task
6. AI-generated implementation

Do not silently reinterpret the authoritative design.

---

# 4. REQUIRED REFACTOR — BACKFILL ENGINE

## 4.1 Scope

Inspect every file under:

```text
/server/src/migrations/backfill/
```

Identify every usage of generated Prisma model delegates such as:

```typescript
prisma.inventoryItem.findUnique(...)
prisma.productVariant.findUnique(...)
prisma.storageLocation.findUnique(...)
prisma.inventoryBalance.findUnique(...)
prisma.paymentTransaction.findUnique(...)
```

and all other target-model delegates.

Create a complete dependency inventory before modification.

## 4.2 Required implementation strategy

Refactor migration workers to use raw SQL through the existing Prisma connection object, following the already-working migration pattern used by:

- `01_tenant_audit.ts`
- `07_user_model_b.ts`
- `08_order_items.ts`
- `10_archive_stock_movements.ts`

Use parameterized raw SQL.

Preferred primitives:

```typescript
prisma.$queryRawUnsafe(...)
prisma.$executeRawUnsafe(...)
```

Parameters MUST be bound safely. Do not construct user/data values by unsafe string concatenation.

Do NOT introduce a second Prisma client.

Do NOT generate or replace the application Prisma client.

---

# 5. WORKER-BY-WORKER REQUIREMENTS

Audit and repair, at minimum:

```text
02_storage_locations.ts
03_inventory_items.ts
04_product_variants.ts
05_inventory_balances.ts
06_inventory_ledger_baseline.ts
09_payment_transactions.ts
```

Also inspect ALL other workers for hidden target-model delegate usage and repair any that remain.

Each worker must preserve:

- deterministic UUIDv5 IDs,
- tenant scoping,
- source-to-target mapping from Prompt 13.3,
- idempotency,
- dry-run semantics,
- rerun safety,
- exact null/default rules,
- ODR-05 compliance,
- User Model B rules,
- no synthetic recipe/modifier/service records.

---

# 6. DRY-RUN CONTRACT

The migration context must provide a strict dry-run mode.

When:

```text
--dry-run
```

is supplied:

- SELECT/query operations may execute.
- No INSERT/UPDATE/DELETE may execute.
- The worker should calculate and report intended mutations.
- The worker must not depend on target Prisma delegates.
- The run must complete without runtime `undefined.findUnique`-style exceptions.

Where practical, add explicit SQL-operation guards so an accidental write in dry-run fails closed.

Do not claim Dry-Run Ready until a complete end-to-end dry-run against an isolated disposable database has been demonstrated to perform zero writes.

---

# 7. OPENING INVENTORY LEDGER RULE — OD-13.3-01

The Owner approved Option A.

For each calibrated opening `inventory_balances` row, the Backfill worker may later create exactly one opening ledger record with:

```text
movement_type = OPNAME_ADJUSTMENT
reference_type = STOCK_OPNAME
actor_type = SYSTEM
quantity_delta = calibrated opening stock
```

This is NOT permission to execute it now.

During this prompt, only ensure the implementation correctly represents this future behavior.

The 4 historical `stock_movements` rows MUST remain governed by ODR-05:

```text
legacy_stock_movements = archive-only
inventory_ledgers = must NOT receive historical stock_movements
```

---

# 8. USER PIN RULE — OD-13.3-03

For users where:

```text
users.pin IS NULL
```

the migration must:

- keep `users.pin_hash = NULL`,
- generate/provision `user_code` deterministically,
- record an operational credential notice/exception,
- NOT invent `mustChangePin`,
- NOT invent `forcePinReset`,
- NOT generate a temporary PIN.

The backfill implementation must not expose a legacy plaintext PIN as a new output artifact.

For the current Owner user specifically:

```text
pin_hash = NULL
user_code = deterministic owner code
```

and the operational notice must be explicit.

---

# 9. RECONCILIATION CHECKER FIX

Inspect:

```text
/server/src/migrations/reconciliation/reconcile_tenant_integrity.ts
```

The current defect is:

```sql
SELECT count(*)::int as count
FROM "order_items" oi
JOIN "orders" o ON o.id = oi.order_id
WHERE oi.tenant_id != o.tenant_id;
```

`order_items` has no `tenant_id`.

Replace this logic with a schema-correct tenant integrity check.

The checker must validate tenant inheritance through the actual schema, for example:

```text
order_items -> orders -> tenant
```

and, where relevant:

```text
order_items -> product_variant -> product -> tenant
```

Do not invent a `tenant_id` column on `order_items`.

The check must detect cross-tenant references rather than merely removing the failing clause.

---

# 10. RECONCILIATION COVERAGE

Review all reconciliation scripts under:

```text
/server/src/migrations/reconciliation/
```

and verify they do not contain:

- references to removed/nonexistent target columns,
- references to legacy enum labels,
- references to `order_items.tenant_id`,
- assumptions that `stock_movements` are migrated into `inventory_ledgers`,
- missing batch dimension where inventory batch is relevant,
- incorrect multiplier handling for opening physical stock.

At minimum verify the invariants defined in Prompt 13.3:

```text
INV-01 Tenant Boundary
INV-02 Product Coverage
INV-03 Variant Coverage
INV-04 SKU Preservation
INV-05 Location Coverage
INV-06 Stock Calibration Parity
INV-07 Ledger Mathematical Audit
INV-08 ODR-05 Compliance
INV-09 User Code Coverage
INV-10 Credential Security
INV-11 OrderItem FK Parity
INV-12 Financial Parity
INV-13 Recipe / Modifier Cleanliness
INV-14 Protected Legacy Preservation
INV-15 Idempotent Rerunnability
```

Do NOT execute any live Backfill.

---

# 11. IDEMPOTENCY AND RERUN SAFETY

All target insert logic must remain deterministic and rerunnable.

Use:

```text
UUIDv5
ON CONFLICT DO NOTHING
```

where compatible with the authoritative design.

Transition-column updates must remain safely idempotent.

Do not introduce random UUIDs for synthesized migration entities.

Do not use non-deterministic fallback IDs.

Do not silently alter the existing approved UUIDv5 namespace strategy.

---

# 12. PARAMETERIZATION / SQL SAFETY REVIEW

For every raw SQL statement added or modified:

1. Identify parameters.
2. Bind data values safely.
3. Do not interpolate legacy data directly into SQL.
4. Keep identifiers static and code-defined.
5. Preserve tenant scoping in every target query.
6. Ensure dry-run cannot call write primitives accidentally.

Produce a small static audit report listing the modified worker and the SQL-operation category used.

---

# 13. TESTING REQUIRED IN THIS PROMPT

Testing must be non-destructive to `pos_db`.

## Test A — Static delegate scan

Scan:

```text
/server/src/migrations/backfill/
```

and confirm there are zero calls to generated target model delegates such as:

```text
inventoryItem.*
productVariant.*
storageLocation.*
inventoryBalance.*
inventoryLedger.*
paymentTransaction.*
```

through `@prisma/client`.

## Test B — TypeScript / syntax validation

Validate the modified migration and reconciliation code.

No application Prisma generation is allowed.

## Test C — Disposable dry-run

Create or use an explicitly isolated disposable PostgreSQL database.

Run:

```text
backfill --dry-run
```

against that disposable database only.

Verify:

- process exits successfully,
- no runtime delegate errors,
- no write SQL occurs,
- intended operation counts are reported,
- deterministic IDs are reported consistently,
- no target rows are created.

## Test D — Reconciliation checker

Run reconciliation checks against the isolated/disposable database/schema fixture.

Verify the `order_items.tenant_id` failure is gone.

## Test E — Determinism

Execute dry-run twice against the same isolated fixture and verify:

```text
same source rows
same generated IDs
same intended mutation counts
same exception list
```

---

# 14. EVIDENCE TO CAPTURE

Produce a final report:

```text
/docs/validation/17_PROMPT_13_3B_BACKFILL_ENGINE_REFACTOR_AND_RECONCILIATION_FIX_REPORT.md
```

The report must include:

1. Files inspected.
2. Files modified.
3. Every Prisma delegate removed/replaced.
4. SQL strategy used per worker.
5. Reconciliation checker correction.
6. Static delegate scan result.
7. TypeScript/syntax validation result.
8. Disposable dry-run result.
9. Evidence that disposable dry-run performed zero writes.
10. Determinism test result.
11. Remaining blockers, if any.
12. Explicit confirmation that `pos_db` was not mutated.
13. Explicit confirmation that no application Prisma generate was run.
14. Final gate.

---

# 15. FINAL GATE

Choose exactly one:

```text
READY FOR PROMPT 13.3C — DRY-RUN VALIDATION & OWNER EXECUTION AUTHORIZATION
```

only if:

- all migration target Prisma delegates are removed,
- reconciliation checker is corrected,
- dry-run is operational,
- disposable dry-run is proven write-free,
- deterministic behavior is verified,
- no unresolved correctness blocker remains.

Otherwise:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

List each blocker precisely.

---

# 16. STOP RULE

STOP after producing the final report.

Do NOT:

- run Backfill against `pos_db`,
- perform live DML,
- perform Cutover,
- modify application runtime,
- run Prisma generate,
- proceed to Prompt 14.

The next stage, if this gate is READY, is Prompt 13.3C for dry-run validation and a separate explicit owner authorization before any live Backfill DML.
