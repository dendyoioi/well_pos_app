# PROMPT 12.5-C — ENUM BASELINE & TARGET CONTRACT RECONCILIATION

## Project
Well POS Multi-Tenant SaaS Platform — Core Engine + Multi-Vertical Industry Modules

## Execution Stage
Prompt 12.5-C — Enum Baseline & Target Contract Reconciliation

## Preceding Gate
Prompt 12.5 = BLOCKED / OWNER REVIEW REQUIRED

## Date
2026-09-20

## Classification
STRICT READ-ONLY / EVIDENCE RECONCILIATION ONLY

---

# 1. Mission

Reconcile documentation and evidence inconsistencies discovered during Prompt 12.5 concerning legacy PostgreSQL enum baselines and the canonical Target Database Schema Revision 4 enum contracts.

This prompt exists to make the migration evidence internally consistent before any Owner Decision Register (ODR) decision or Prompt 13 is authorized.

This prompt MUST NOT:
- execute DDL or DML against real `pos_db`;
- mutate any database;
- alter enum vocabulary;
- create, drop, rename, or alter enum types;
- execute Expand, Backfill, Dual-Write, Validate/Cutover, or Contract migration phases;
- make or infer Owner business decisions;
- modify Target Database Schema Revision 4;
- authorize Prompt 13.

---

# 2. Authoritative Source Hierarchy

Use this hierarchy strictly:

1. Existing source code + actual PostgreSQL catalog evidence from real `pos_db`
2. Approved Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`)
3. Approved ADRs / architecture decisions
4. Prior validated migration artifacts
5. Prompt 12.5 evidence artifacts
6. Generated analysis

If two artifacts conflict, DO NOT silently choose one. Record the conflict, identify the authoritative source, and explain the resolution.

---

# 3. Known Reconciliation Targets

Prompt 12.5 identified at least these discrepancies:

### 3.1 TenantStatus baseline discrepancy

One earlier evidence chain represented legacy `TenantStatus` as:

- TRIAL
- ACTIVE
- SUSPENDED
- CANCELLED
- PENDING

Prompt 12.5 live evidence reports the actual `pos_db` catalog as:

- ACTIVE
- SUSPENDED
- INACTIVE
- TRIAL
- PENDING

Target Revision 4 is:

- TRIAL
- ACTIVE
- SUSPENDED
- CANCELLED

Required outcome:
- determine the actual current PostgreSQL catalog labels and order from `pos_db`;
- identify which prior artifact contained the divergent `CANCELLED` / `INACTIVE` representation;
- explicitly mark the erroneous or stale evidence;
- preserve the live catalog as the factual legacy baseline;
- do NOT alter the target contract.

Also verify:
- current row distribution;
- defaults;
- application references to `PENDING` and `INACTIVE`;
- whether either label is currently present in live rows.

### 3.2 InvoiceStatus / SubscriptionInvoiceStatus discrepancy

Prompt 12.5 data evidence contains a reference to:

`SubscriptionInvoiceStatus = DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE`

while the canonical Target Revision 4 and Expand artifacts previously specify:

`InvoiceStatus = DRAFT, UNPAID, PAID, VOID`

Required outcome:
- inspect the canonical Target Revision 4 document directly;
- inspect the active target Prisma schema / migration contract;
- determine whether `SubscriptionInvoiceStatus` is actually a Target Revision 4 enum or merely stale/foreign terminology;
- determine the actual legacy `InvoiceStatus` PostgreSQL catalog labels;
- explicitly identify any stale terminology;
- preserve the canonical Target Revision 4 contract unchanged unless the actual architecture document itself proves otherwise.

### 3.3 Do not infer semantic mappings

The reconciliation must distinguish:

- exact vocabulary equality;
- vocabulary difference;
- nomenclature difference;
- semantic mapping candidate;
- approved migration mapping.

For example:

`CANCELLED → VOID`

must NOT be described as an approved migration mapping merely because it appears semantically plausible.

If no Owner decision exists, label it:

`MAPPING CANDIDATE — OWNER DECISION REQUIRED`

---

# 4. Required Evidence Checks

## E-01 — Live Enum Catalog

For every affected enum:

- `pg_type`
- `pg_namespace`
- `pg_enum`
- `enumsortorder`

must be inspected.

Record:

- enum existence;
- schema;
- type kind;
- exact ordered labels.

No mutation.

## E-02 — Live Column Usage

Inspect:

- `information_schema.columns`
- `column_default`
- `is_nullable`
- `udt_schema`
- `udt_name`

for all affected enum-backed columns.

## E-03 — Live Data Distribution

For each affected column record:

- total rows;
- NULL count;
- distinct values;
- count per enum value;
- values defined in catalog but unused.

## E-04 — Application Dependency

Inspect repository source references for:

- enum constants;
- defaults;
- Zod/native enum validation;
- controller writes;
- frontend role/status selectors;
- signup/onboarding transitions.

Do not modify source.

## E-05 — Target Contract

Read the actual canonical Target Database Schema Revision 4.

For each affected target enum record:

- exact enum name;
- exact ordered labels;
- owning model/field;
- default if applicable.

## E-06 — Artifact Provenance

For each conflicting prior statement, record:

| Evidence | Source | Claim | Actual Status | Resolution |
|---|---|---|---|---|

No silent correction.

---

# 5. Required Output Artifacts

Create/update ONLY analysis and reconciliation documents.

## 5.1 `/docs/validation/11_PROMPT_12_5_C_ENUM_BASELINE_RECONCILIATION.md`

Must contain:

1. Executive Summary
2. Previous Prompt 12.5 blocker
3. Evidence hierarchy
4. Live PostgreSQL baseline
5. TenantStatus reconciliation
6. InvoiceStatus reconciliation
7. Target contract verification
8. Application dependency reconciliation
9. Artifact provenance/conflict matrix
10. Exact-vs-semantic mapping classification
11. Unresolved Owner Decisions
12. Migration implications
13. Explicit non-actions
14. Final gate verdict

## 5.2 `/docs/validation/11_PROMPT_12_5_C_ENUM_BASELINE_MATRIX.md`

Columns:

| Enum | Live Legacy Labels | Target Labels | Exact Match | Vocabulary Delta | Data Present | Application Dependency | Mapping Status | Evidence Source | Resolution |

## 5.3 `/docs/validation/11_PROMPT_12_5_C_ENUM_EVIDENCE_PROVENANCE.md`

For every corrected statement:

- previous statement;
- source artifact;
- live evidence;
- canonical source;
- corrected statement;
- reason.

---

# 6. Mandatory Acceptance Criteria

### C-01 — No Database Mutation
PASS only if:
- zero DDL;
- zero DML;
- zero enum alteration;
- zero transaction commit containing schema/data mutation.

### C-02 — TenantStatus Ground Truth
PASS only if exact live labels/order are recorded directly from `pg_enum`.

### C-03 — InvoiceStatus Ground Truth
PASS only if exact live labels/order are recorded directly from `pg_enum`.

### C-04 — Target Contract Ground Truth
PASS only if Target Revision 4 is inspected directly and its enum contract is quoted/paraphrased without relying on stale secondary artifacts.

### C-05 — No Silent Reconciliation
Every conflicting artifact must be explicitly listed.

### C-06 — Mapping Separation
No semantic mapping becomes an approved migration mapping without Owner approval.

### C-07 — Application Coupling
`PENDING`, `WAREHOUSE`, and other actively referenced legacy values must remain identified as application dependencies where applicable.

### C-08 — Evidence Reproducibility
The report must document the exact read-only SQL/query approach used to establish catalog ground truth.

### C-09 — Canonical Contract Preservation
Prompt 12.5-C must not modify Target Revision 4.

### C-10 — Owner Decision Separation
ODR decisions remain OPEN unless already explicitly approved in the canonical project records.

### C-11 — No Prompt 13 Authorization
This prompt cannot authorize Prompt 13.

### C-12 — Internal Consistency
All three output artifacts must contain identical baseline conclusions.

---

# 7. Required Test / Validation Scenarios

At minimum:

1. TenantStatus catalog exact-match extraction.
2. TenantStatus order extraction.
3. TenantStatus live row distribution.
4. TenantStatus default extraction.
5. TenantStatus application reference scan.
6. InvoiceStatus catalog exact-match extraction.
7. InvoiceStatus order extraction.
8. InvoiceStatus live row distribution.
9. InvoiceStatus default extraction.
10. InvoiceStatus application reference scan.
11. Target Revision 4 enum extraction.
12. Cross-artifact discrepancy detection.
13. Mapping classification test: exact vs candidate vs approved.
14. Evidence provenance completeness.
15. Mutation safety static scan.
16. Final three-artifact consistency check.

---

# 8. Forbidden Actions

The executing agent MUST NOT:

- run `ALTER TYPE`;
- run `CREATE TYPE`;
- run `DROP TYPE`;
- run `DROP TABLE`;
- run `DELETE`;
- run `UPDATE`;
- run `INSERT`;
- run `TRUNCATE`;
- modify Prisma schema;
- modify migration SQL;
- modify rollback SQL;
- modify Target Revision 4;
- modify source code;
- make ODR decisions;
- execute any migration phase;
- start Prompt 13.

---

# 9. Final Gate

Allowed verdicts:

- `READY FOR OWNER REVIEW`
- `BLOCKED / OWNER REVIEW REQUIRED`

`GO`, `GO WITH CONDITIONS`, or migration execution authorization are NOT allowed.

Use:

`READY FOR OWNER REVIEW`

only when:
- C-01 through C-12 pass;
- TenantStatus baseline is proven;
- InvoiceStatus baseline is proven;
- Target Revision 4 contract is proven;
- all artifact conflicts are reconciled;
- no unexplained contradiction remains.

Otherwise:

`BLOCKED / OWNER REVIEW REQUIRED`

---

# 10. Final Report Format

End the report with:

```text
PROMPT 12.5-C FINAL GATE
=========================

C-01 No Database Mutation: PASS/FAIL
C-02 TenantStatus Ground Truth: PASS/FAIL
C-03 InvoiceStatus Ground Truth: PASS/FAIL
C-04 Target Contract Ground Truth: PASS/FAIL
C-05 No Silent Reconciliation: PASS/FAIL
C-06 Mapping Separation: PASS/FAIL
C-07 Application Coupling: PASS/FAIL
C-08 Evidence Reproducibility: PASS/FAIL
C-09 Canonical Contract Preservation: PASS/FAIL
C-10 Owner Decision Separation: PASS/FAIL
C-11 No Prompt 13 Authorization: PASS/FAIL
C-12 Internal Consistency: PASS/FAIL

FINAL GATE:
READY FOR OWNER REVIEW
or
BLOCKED / OWNER REVIEW REQUIRED
```

## Owner Review Boundary

Completion of Prompt 12.5-C does NOT mean enum migration is approved.

After this prompt, the Project Owner must review:
- corrected legacy enum baseline;
- canonical Target Revision 4 enum contract;
- unresolved semantic mappings;
- Owner Decision Register.

Only after explicit Owner decisions and a separate migration-readiness gate may implementation preparation continue.
