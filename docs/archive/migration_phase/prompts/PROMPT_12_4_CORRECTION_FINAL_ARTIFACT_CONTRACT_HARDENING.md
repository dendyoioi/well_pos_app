# PROMPT 12.4 CORRECTION — FINAL EXECUTABLE ARTIFACT CONTRACT HARDENING

## Project
Well POS Multi-Tenant SaaS Platform

## Execution Stage
Prompt 12.4 Correction — Final executable migration artifact hardening

## Preceding Gate
Prompt 12.4 = `BLOCKED / OWNER REVIEW REQUIRED`

## Purpose

Perform ONLY the narrow correction required to resolve the blockers identified in the independent review of Prompt 12.4.

The goal is to make the following invariant substantively true:

```text
ACTUAL MIGRATION OBJECTS
=
PREFLIGHT-CHECKED OBJECTS
=
OWNERSHIP-REGISTERED OBJECTS
=
ROLLBACK-CONTROLLED OBJECTS
=
DOCUMENTED OBJECT INVENTORY
=
TARGET SCHEMA CONTRACT
```

This is an executable-artifact safety correction.

DO NOT redesign Target Database Schema Revision 4.

DO NOT start Backfill.

DO NOT start Dual-Write.

DO NOT start Cutover.

DO NOT start Contract.

DO NOT start Prompt 13.

---

# 1. SOURCE-OF-TRUTH HIERARCHY

Use this hierarchy:

1. Existing source code + existing database/schema
2. Approved Target Database Schema Revision 4
3. Approved migration architecture / ADRs
4. Prompt 12 / Prompt 12.4 requirements
5. Generated implementation artifacts

If a generated report conflicts with executable migration SQL or the approved Target Schema, the executable artifact must be corrected.

Do not make a report "pass" by weakening the validation criteria.

---

# 2. CORRECTION C-01 — ACTUAL INDEX CONTRACT MUST BE COMPLETE

Previous review found that Prompt 12.4 correctly discovered 34 indexes by count, but the documented/preflighted definitions did not consistently match the executable `migration.sql`.

For EVERY index actually created or touched by migration.sql:

## Required contract

Validate and document:

- index name
- parent table
- uniqueness
- access method
- ordered indexed columns
- column order
- expressions, if any
- partial predicate, if any
- included columns, if any
- index definition as returned by PostgreSQL catalog
- ownership state
- rollback behavior

Use PostgreSQL catalog sources such as:

- `pg_class`
- `pg_index`
- `pg_attribute`
- `pg_indexes`
- `pg_get_indexdef()`

Do not treat:

```text
same index name
+
same table
+
same uniqueness
```

as sufficient compatibility.

## Critical invariant

For every index:

```text
EXPECTED INDEX CONTRACT
=
ACTUAL CATALOG INDEX DEFINITION
=
PREFLIGHT CONTRACT
=
OWNERSHIP RECORD
=
ROLLBACK POLICY
=
DOCUMENTED INVENTORY
```

The 34-index count must remain derived from the executable artifact.

Do NOT hardcode an assumed count without also deriving and validating the actual object set.

---

# 3. CORRECTION C-02 — FULL TARGET TABLE CONTRACT

Previous Prompt 12.4 claimed "full structural contract" but validation remained subset-oriented.

Correct this.

For each of the 18 target domain tables, derive the expected contract from Target Database Schema Revision 4 and validate the COMPLETE structure.

At minimum validate:

### Columns
- complete column set
- no missing target column
- PostgreSQL type
- UDT / enum type
- nullability
- default expression
- numeric precision
- numeric scale
- varchar/text length where applicable
- generated/identity properties where applicable

### Primary key
- PK existence
- PK columns
- PK column order

### Unique constraints/indexes
- uniqueness
- columns
- order
- predicate where applicable

### Foreign keys
- referenced table
- referenced columns
- local columns
- column order
- ON DELETE
- ON UPDATE

### Check constraints
- presence
- definition

### Other relevant structural properties
- identity/generated columns
- table-level constraints
- required relation semantics

If an existing target table is missing ANY required target element or has an incompatible definition:

```text
ABORT BEFORE MUTATION
```

with a deterministic compatibility violation.

Do not classify a table as compatible merely because its PK and a subset of columns match.

---

# 4. CORRECTION C-03 — TRANSITION COLUMN CONTRACT

For every transition column added to legacy tables, validate:

- table
- column name
- type / UDT
- enum type
- nullability
- default expression
- precision
- scale
- max length
- generated/identity status
- ownership

The actual executable column definition must be the source from which the inventory is generated.

If an existing column has incompatible semantics:

```text
COLUMN COMPATIBILITY VIOLATION
```

and abort before mutation.

Do not silently reuse an incompatible column.

---

# 5. CORRECTION C-04 — COMPLETE FK / CONSTRAINT ACCOUNTING

The previous report counted 40 target-table foreign keys, but the migration also touches FK relationships through transition columns.

Resolve this ambiguity explicitly.

For EVERY FK/constraint actually created or touched by migration.sql, define:

- constraint name
- constraint type
- owning table
- local columns
- referenced table
- referenced columns
- ON DELETE
- ON UPDATE
- ownership state
- preflight validation
- rollback behavior
- inventory entry

The accounting must distinguish:

1. target-table constraints
2. transition-column constraints
3. pre-existing constraints merely observed but not created

Do not claim "all constraints reconciled" unless every touched constraint is covered.

If a constraint is owned indirectly by a created table and is automatically removed with that table, document that exact lifecycle rather than inventing a separate rollback operation.

---

# 6. CORRECTION C-05 — ONE-SOURCE-OF-TRUTH OBJECT DISCOVERY

Do NOT manually maintain separate object lists.

Build the authoritative object inventory from the executable migration artifact.

The implementation should programmatically derive:

- CREATE TYPE objects
- CREATE TABLE objects
- ADD COLUMN objects
- CREATE INDEX objects
- UNIQUE indexes
- PK constraints
- UNIQUE constraints
- FK constraints
- CHECK constraints
- other created/touched objects

Then reconcile those derived objects against:

- preflight checks
- ownership registry
- rollback logic
- documentation inventory

Required invariant:

```text
ACTUAL SQL DISCOVERY
        =
PREFLIGHT COVERAGE
        =
OWNERSHIP COVERAGE
        =
ROLLBACK COVERAGE
        =
DOCUMENTATION COVERAGE
```

Any difference is a blocker.

---

# 7. CORRECTION C-06 — OWNERSHIP SEMANTICS

Use only these ownership states:

- `CREATED_BY_PROMPT_12`
- `PRE_EXISTING_COMPATIBLE_REUSED`
- `PRE_EXISTING_INCOMPATIBLE`
- `UNKNOWN`

Fail closed on:

- UNKNOWN
- PRE_EXISTING_INCOMPATIBLE

The ownership registry itself must have deterministic lifecycle semantics.

Do not use `IF NOT EXISTS` as a substitute for ownership determination.

If an object already exists:

1. inspect it
2. validate complete compatibility
3. classify it
4. register the classification
5. only then allow reuse

---

# 8. CORRECTION C-07 — ROLLBACK MUST BE OWNERSHIP-BASED

Rollback must remove ONLY objects proven to have:

```text
ownership = CREATED_BY_PROMPT_12
```

It must preserve:

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

It must never operate on:

```text
PRE_EXISTING_INCOMPATIBLE
UNKNOWN
```

For indexes on reused tables, explicit rollback control is required.

For constraints belonging to Prompt 12-created tables, document whether they are removed automatically with the owned table. Do not use unsafe standalone drops where ownership is ambiguous.

No `CASCADE` rollback shortcuts.

No blind DROP of reused objects.

---

# 9. CORRECTION C-08 — 18 LEGACY TABLE PROTECTION

Explicitly verify all 18 legacy tables:

1. tenants
2. outlets
3. users
4. products
5. categories
6. customers
7. orders
8. order_items
9. payments
10. shifts
11. subscription_plans
12. tenant_subscriptions
13. saas_invoices
14. saas_payments
15. platform_users
16. outlet_products
17. stock_movements
18. hold_orders

Requirements:

- no DROP TABLE
- no TRUNCATE
- no DELETE
- no destructive column replacement
- only explicitly authorized additive transition columns
- rollback may remove only Prompt-12-owned transition columns

Test every one of the 18 tables.

---

# 10. CORRECTION C-09 — INDEX DEFINITION REGRESSION TESTS

Add tests that deliberately detect differences in:

1. index column list
2. index column order
3. uniqueness
4. partial predicate
5. expression index
6. included columns
7. access method
8. same name but different definition
9. same definition but different name
10. all actual 34 migration indexes

A test that only checks "34 indexes exist" is insufficient.

---

# 11. CORRECTION C-10 — TARGET TABLE REGRESSION TESTS

Add tests that deliberately detect:

- missing target column
- wrong target column type
- wrong enum UDT
- wrong nullability
- wrong default
- wrong precision
- wrong scale
- missing PK
- wrong PK columns/order
- missing unique constraint
- wrong FK
- wrong FK action
- missing CHECK constraint

All must abort before mutation.

---

# 12. CORRECTION C-11 — TRANSITION FK COVERAGE

Explicitly test the transition FKs, if present in migration.sql, including at minimum:

- `categories.parent_id`
- `order_items.product_variant_id`

Do not leave these outside the object accounting merely because they are attached to legacy tables.

Their lifecycle must be deterministic.

---

# 13. CORRECTION C-12 — DOCUMENTATION REGENERATION

Regenerate these documents from the corrected executable artifacts:

### Required

```text
/docs/validation/10_PROMPT_12_4_OBJECT_OWNERSHIP_INVENTORY.md
/docs/validation/10_PROMPT_12_4_OBJECT_RECONCILIATION.md
/docs/validation/10_PROMPT_12_4_FINAL_REVALIDATION.md
```

The documents must NOT contain manually asserted object definitions that differ from executable migration SQL.

For every object category provide:

```text
ACTUAL
PREFLIGHT
OWNERSHIP
ROLLBACK
DOCUMENTED
STATUS
```

and the status must be based on substantive definition equality, not only object counts.

---

# 14. REQUIRED RECONCILIATION MATRIX

Produce a machine-derived matrix:

| Object | Actual SQL | Target Contract | Preflight | Ownership | Rollback | Documentation | Status |
|---|---|---|---|---|---|---|---|

Every row must resolve to:

```text
MATCH
```

or the final gate is:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 15. REQUIRED TEST MATRIX

At minimum run:

### Baseline
1. Clean legacy database → migration PASS → rollback PASS

### Registry
2. Compatible registry → reuse + rollback preservation
3. Incompatible registry → abort before mutation

### Tables
4. Missing target column → abort
5. Wrong target column type → abort
6. Nullability mismatch → abort
7. Default mismatch → abort
8. Missing PK/unique/FK/check contract → abort

### Indexes
9. Existing exact index → reuse
10. Existing same-name/different-definition index → abort
11. Same definition/different-name custom index → preserve safely
12. Predicate mismatch → abort
13. Column/order mismatch → abort
14. All actual indexes reconciled

### Legacy
15. All 18 legacy tables preserved

### Rollback
16. Reused objects preserved
17. Prompt-12-created objects removed
18. Unknown ownership blocks rollback

Additional tests are allowed if needed.

---

# 16. STATIC SAFETY SCAN

Verify migration artifact contains no unintended:

- DROP TABLE
- DROP COLUMN
- DROP TYPE
- TRUNCATE
- DELETE
- CASCADE

Any intentional occurrence must be explained and proven safe.

Rollback may contain controlled DROP operations only when ownership is proven.

---

# 17. EXECUTION BOUNDARY

Allowed:

- disposable isolated local PostgreSQL
- static analysis
- SQL parsing
- migration artifact generation
- rollback testing
- schema/catalog inspection
- automated tests

Forbidden:

- staging database migration
- production database migration
- `prisma migrate deploy` against staging/production
- `prisma db push` against staging/production
- Backfill execution
- Dual-write
- Cutover
- Contract phase
- Prompt 13

Do not modify production or staging data.

---

# 18. FINAL GATE

At completion, return exactly ONE:

```text
READY FOR OWNER REVIEW
```

only if:

- every actual object is covered
- every target contract is substantively validated
- every index definition is reconciled
- every FK/constraint touched is accounted for
- ownership is deterministic
- rollback is ownership-safe
- all 18 legacy tables are protected
- required tests pass
- no unexplained mismatch remains

Otherwise return:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

Do not start Prompt 13.

STOP after the final gate.
