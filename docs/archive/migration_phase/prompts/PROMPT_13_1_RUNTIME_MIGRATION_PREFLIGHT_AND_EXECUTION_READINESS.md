# PROMPT 13.1 — RUNTIME MIGRATION PREFLIGHT & EXECUTION READINESS

## DOCUMENT CONTROL

**Stage:** Prompt 13.1 — Runtime Migration Preflight & Execution Readiness  
**Parent Gate:** Prompt 12.6-E  
**Purpose:** Runtime and database preflight before the first authorized execution of the Expand migration lifecycle  
**Execution Mode:** READ-ONLY / PREFLIGHT ONLY  
**Migration Execution:** PROHIBITED  
**Backfill:** PROHIBITED  
**Dual-write:** PROHIBITED  
**Cutover:** PROHIBITED  
**Contract:** PROHIBITED  
**Prompt 13.2:** PROHIBITED  
**Prompt 13.x after 13.1:** PROHIBITED unless separately authorized

---

# 1. ROLE

You are **Antigravity**, acting as:

**Lead Database & Systems Architect + Migration Safety Lead + Runtime Readiness Reviewer**

Your responsibility is to determine, using actual evidence, whether the current runtime/database environment is sufficiently prepared for a separately authorized execution of the Expand migration.

This is a **preflight and gate assessment**, not a migration execution task.

---

# 2. CONTEXT

Prompt 12.6-E has reached the following state:

- Target Contract Reconciliation = **PASS**
- Live Legacy Enum Compatibility = **FAIL-CLOSED for 7 pre-existing incompatible enums**
- Validation suite = **102/102 PASS**
- Expand DDL safety scanner = **PASS, 0 violations**
- Protected legacy baseline = **18 tables**
- Target Core Tables = **18**
- Target Custom Enums = **20**
- Transition Columns = **23**
- Target Indexes = **34**
- Target Foreign Keys = **40**
- Transition Foreign Keys = **2**
- Real `pos_db` remains untouched
- Prompt 13 has not been executed

Prompt 12.6-E explicitly stopped at the gate:

**READY FOR PROMPT 13**

This prompt is the first step in the execution-readiness stage.

---

# 3. OBJECTIVE

Determine whether the actual runtime and database environment satisfies all known prerequisites required before an authorized Expand execution.

The question to answer is:

> **“Is the environment demonstrably ready for Expand execution, or is there a blocker that must be resolved first?”**

Do not execute Expand to answer this question.

---

# 4. SOURCE-OF-TRUTH HIERARCHY

Use this hierarchy when evaluating discrepancies:

1. Actual target database connection/runtime state
2. Executable `migration.sql`
3. Executable `rollback.sql`
4. Approved Target Database Schema Revision 4
5. Prisma target schema
6. Application enum/RBAC and migration-related runtime contract
7. Approved Owner Decisions ODR-01 through ODR-06
8. Prompt 12.x validation evidence
9. Generated documentation

Do not treat previous reports as proof of current runtime readiness.

Actual environment evidence takes precedence over assumptions.

---

# 5. CORE PRINCIPLES

## 5.1 Evidence over assumption

Do not state:

- “backup exists” without evidence;
- “database is correct” without inspection;
- “migration can run safely” without preflight evidence;
- “there are no blockers” without checking the relevant category.

## 5.2 Read-only first

Unless an operation is explicitly identified as harmless/read-only diagnostic inspection, do not execute it.

## 5.3 No mutation

No DDL or DML may be executed against real `pos_db` during Prompt 13.1.

## 5.4 Fail closed

When evidence is missing, contradictory, or insufficient for a safety-critical prerequisite:

**BLOCKED / OWNER REVIEW REQUIRED**

Do not infer GO from absence of an error.

## 5.5 Separate readiness from authorization

Even if the environment is technically ready, this prompt does not authorize Expand execution.

---

# 6. NON-GOALS / PROHIBITED ACTIONS

Do NOT:

- run `migration.sql` against `pos_db`;
- run `prisma migrate deploy` against the target runtime;
- run rollback against `pos_db`;
- create target tables;
- alter live enums;
- add transition columns;
- create indexes or foreign keys;
- backfill data;
- activate dual-write;
- switch application read/write paths;
- perform cutover;
- retire legacy objects;
- reset/truncate/delete data;
- modify live database records;
- start Prompt 13.2;
- start any later migration phase.

If a tool/command has both read and write behavior, do not use it unless the read-only behavior is unambiguously guaranteed and explicitly documented.

---

# 7. EXECUTION PROTOCOL

Follow this staged workflow exactly:

```text
READ
  ↓
UNDERSTAND
  ↓
VERIFY ENVIRONMENT
  ↓
VERIFY DATABASE BASELINE
  ↓
VERIFY MIGRATION APPLICABILITY
  ↓
VERIFY RECOVERY READINESS
  ↓
VERIFY DATA / IDENTITY PREREQUISITES
  ↓
VERIFY RUNTIME / APPLICATION PREREQUISITES
  ↓
RISK ANALYSIS
  ↓
REPORT FINDINGS
  ↓
READINESS GATE
  ↓
STOP
```

Do not skip directly to execution.

---

# 8. PHASE 1 — READ

Before any readiness judgment, inspect:

## Migration artifacts

- Expand `migration.sql`
- Expand `rollback.sql`
- migration directory metadata
- migration ownership/registry logic
- migration-related tests

## Schema artifacts

- `schema.prisma`
- Target Database Schema Revision 4
- relevant architecture and migration guardrail documents

## Application artifacts

- application database configuration
- Prisma configuration
- startup/runtime environment handling
- migration-related scripts
- enum/RBAC contract
- tenant resolution logic relevant to migration safety

## Previous evidence

- Prompt 12.6-E Final Report
- Prompt 12.6-E Validation Evidence
- Object Inventory
- previous Migration Readiness Report
- Expand Plan
- Backfill Design
- Reconciliation Plan
- Execution Guardrails

Do not assume these documents are still current.
Use them as requirements/evidence references and verify runtime state independently.

---

# 9. PHASE 2 — UNDERSTAND

Establish the intended execution boundary.

The next authorized migration phase, if approved later, is:

**EXPAND ONLY**

Expected conceptual boundary:

```text
CURRENT LEGACY DATABASE
        │
        │ Expand only
        ▼
LEGACY + TARGET STRUCTURES
```

The Expand phase must remain additive and non-destructive.

It must not yet:

- transform business data;
- switch application behavior;
- delete legacy structures;
- perform cutover.

---

# 10. PHASE 3 — DATABASE IDENTITY PREFLIGHT

Verify the exact database connection that would be used for the eventual migration.

Capture, where safely available:

- hostname
- port
- database name
- schema
- PostgreSQL version
- current user/role
- current environment identifier
- current application environment
- connection source/configuration path

The output must clearly answer:

> **What exact database would the migration command connect to?**

## Environment mismatch guard

Fail closed if:

- target database identity cannot be established;
- environment is ambiguous;
- development/staging/production target cannot be distinguished;
- connection configuration differs from the intended migration target;
- credentials or connection path are ambiguous.

Do not "assume localhost is the correct target."

---

# 11. PHASE 4 — LIVE DATABASE BASELINE

Perform read-only inspection of the actual target database.

Establish the current baseline before any migration execution.

Verify at minimum:

## Physical structure

- total base tables;
- exact 18 protected legacy tables;
- current target-table presence/absence;
- current transition-column presence/absence;
- current indexes relevant to the migration;
- current foreign keys relevant to the migration;
- current custom enums and ordered labels;
- current ownership registry presence/absence.

## Data baseline

Verify the current known baseline and record actual values.

Previously observed baseline was:

- 18 base tables;
- 17 total rows across 10 populated tables;
- no `_prompt_12_ownership_registry`.

Do not merely repeat these historical values.
Re-query and record the actual current values.

## Drift detection

Compare actual database structure against the expected pre-Expand state.

Flag:

- unexpected target tables;
- unexpected transition columns;
- unexpected indexes;
- unexpected foreign keys;
- unexpected enum changes;
- unexpected ownership registry;
- unexpected schema objects.

Any unexplained drift is a readiness concern.

---

# 12. PHASE 5 — MIGRATION HISTORY & SCHEMA DRIFT

Verify, using read-only inspection, the migration history relevant to the intended execution path.

Check:

- Prisma migration history;
- actual database migration metadata, if present;
- whether the Expand migration is already recorded as applied;
- whether there are partially applied migrations;
- whether failed migration records exist;
- whether migration ordering is unambiguous;
- whether the current Prisma schema is materially divergent from the target database;
- whether another migration must run before Expand;
- whether the Expand migration depends on a migration that has not been applied.

## Hard stop conditions

BLOCK if:

- the Expand migration is already partially or fully applied unexpectedly;
- migration history is inconsistent with physical database state;
- the database has unexplained migration drift;
- ordering is ambiguous;
- a required predecessor migration is missing.

Do not repair migration history in Prompt 13.1.

---

# 13. PHASE 6 — POSTGRESQL / RUNTIME COMPATIBILITY

Verify the runtime prerequisites relevant to the Expand migration.

Inspect, without mutation:

- PostgreSQL server version;
- extensions required by the migration;
- schema/namespace availability;
- privileges of the migration execution role;
- ability to create required database objects;
- transaction behavior relevant to the migration;
- connection stability;
- session configuration relevant to migration execution;
- timeout-related settings where observable.

Do not test capabilities by creating or altering live objects.

Where a privilege cannot be proven safely, report:

**NOT VERIFIED**

rather than assuming it exists.

---

# 14. PHASE 7 — LOCK & ACTIVE TRANSACTION PREFLIGHT

Inspect current database activity read-only.

Check for:

- long-running transactions;
- active transactions against protected legacy tables;
- blocking locks;
- idle-in-transaction sessions;
- sessions that could materially interfere with DDL execution;
- active application jobs that may conflict with migration timing.

Do not terminate sessions.

Do not cancel transactions.

Do not alter connection state.

Report:

- observed blocking condition;
- source/session where observable;
- likely impact;
- whether it constitutes a blocker at the intended execution window.

If current runtime activity makes safe execution uncertain, fail closed.

---

# 15. PHASE 8 — RECOVERY / BACKUP READINESS

Determine whether a reliable recovery mechanism exists before the first live Expand execution.

Verify evidence for:

- current database backup;
- backup recency;
- backup location/reference;
- restore capability evidence;
- recovery point expectations;
- rollback procedure availability;
- rollback script availability and scope.

Distinguish:

```text
Rollback script exists
```

from:

```text
Database can be recovered
```

These are not equivalent.

A rollback SQL script is not a substitute for database backup/recovery capability.

## Evidence requirement

If a backup is expected but its:

- existence,
- freshness,
- recoverability,

cannot be verified, report the corresponding item as:

**NOT VERIFIED**

and treat the gate according to the project's established risk policy.

Do not create, overwrite, or delete backups in Prompt 13.1 unless an explicit, separately authorized backup operation exists.

---

# 16. PHASE 9 — APPLICATION / RUNTIME QUIESCENCE READINESS

Verify whether the application can safely enter the required migration window.

Inspect, where available:

- current application process state;
- active write paths;
- background workers/jobs;
- scheduled jobs;
- queues;
- cron tasks;
- database clients;
- deployment state;
- maintenance-mode capability;
- ability to freeze or control writes if required by the eventual Expand execution plan.

Do not activate maintenance mode.

Do not stop services.

Do not disable jobs.

Do not change application routing.

This phase is assessment only.

---

# 17. PHASE 10 — MIGRATION APPLICABILITY

Verify that the Expand migration is applicable to the current live database state.

Check:

## Legacy preservation

All 18 protected legacy tables exist and match the expected baseline.

## Target collision

Target tables expected to be created by Expand do not already exist unexpectedly.

Expected target objects include:

- `inventory_items`
- `product_variants`
- `storage_locations`
- `inventory_batches`
- `inventory_balances`
- `inventory_ledgers`
- `unit_conversions`
- `recipes`
- `recipe_items`
- `modifier_groups`
- `modifier_items`
- `product_modifier_groups`
- `modifier_recipe_effects`
- `payment_transactions`
- `refunds`
- `refund_items`
- `idempotency_records`
- `legacy_stock_movements`

## Transition collision

Expected 23 transition columns must not already exist unexpectedly in an incompatible form.

## Object collision

Check for conflicting:

- enum types;
- indexes;
- constraints;
- foreign keys;
- registry objects.

Any unexpected pre-existing target object must be investigated before execution.

---

# 18. PHASE 11 — LIVE ENUM PREFLIGHT

The target contract is already reconciled, but live legacy enum compatibility remains fail-closed.

Verify the actual current state of all live enum types.

Expected known categories:

## Exact-compatible pre-existing

- `BillingCycle`
- `ShiftStatus`
- `TenantStatus`

## Pre-existing incompatible

- `PlatformRole`
- `InvoiceStatus`
- `Role`
- `StockMovementType`
- `PaymentStatus`
- `PaymentMethod`
- `PaymentTxStatus`

Re-query the actual ordered labels.

Do not modify any live enum.

The preflight must verify that the Expand migration's ownership/protection logic handles these existing enum conditions exactly as designed.

If the actual live state differs from the previously verified state, fail closed and report it.

---

# 19. PHASE 12 — TENANT / DATA SAFETY PREREQUISITES

Prompt 13.1 does not perform Backfill, but it must identify known data-state risks that could make the later migration lifecycle unsafe.

Assess the current database for the prerequisite categories previously identified:

- tenant `NULL` conditions;
- default/fallback tenant behavior;
- user identity provisioning readiness;
- legacy PIN representation;
- SKU/barcode uniqueness issues;
- parked/hold order handling;
- legacy stock movement handling;
- tenant isolation hazards;
- other unresolved data anomalies relevant to the approved Backfill Design.

For each category, classify:

- VERIFIED SAFE
- VERIFIED BLOCKER
- NOT VERIFIED
- NOT APPLICABLE

Do not transform data to fix these issues.

---

# 20. PHASE 13 — TENANT ISOLATION PREFLIGHT

Because strict tenant isolation is a core architecture rule, verify readiness for the migration lifecycle.

Inspect:

- tenantId population where required;
- nullability assumptions in target mapping;
- application tenant-resolution behavior;
- default/fallback tenant behavior;
- cross-tenant record anomalies, where safely detectable.

The known existing fallback behavior must not be treated as acceptable merely because it exists in legacy application code.

If a fallback mechanism can cause migration or backfill to associate data with the wrong tenant, classify the related readiness condition as a blocker or unresolved prerequisite.

Do not fix the application in this prompt.

---

# 21. PHASE 14 — USER / PIN MIGRATION READINESS

Verify the preconditions for the previously approved Model B identity migration.

Check:

- userCode availability;
- tenant scoping;
- uniqueness conflicts;
- PIN source representation;
- whether existing PIN values are plaintext, hashed, null, or unknown;
- whether sufficient information exists to deterministically provision the target credential state;
- whether any reset/provisioning workflow must occur.

Do not expose secrets unnecessarily in the report.

Do not transform or reset PINs in Prompt 13.1.

---

# 22. PHASE 15 — PRODUCT / INVENTORY READINESS

Assess whether the legacy catalog can be deterministically mapped later.

Check for:

- duplicate SKU;
- duplicate barcode;
- missing identifiers;
- conflicting product identities;
- missing outlet relationships;
- inconsistent stock records;
- negative/invalid quantities;
- UOM ambiguity where relevant.

No Backfill should be executed here.

The outcome should identify whether the later deterministic Product → ProductVariant → InventoryItem and OutletProduct → InventoryBalance mapping is executable.

---

# 23. PHASE 16 — BACKUP / ROLLBACK / FAILURE SCENARIO REVIEW

Before recommending GO, verify that the eventual execution plan has a controlled failure path.

Review:

- Expand migration transaction behavior;
- rollback script scope;
- ownership registry behavior;
- pre-existing object preservation;
- failure checkpoints;
- operator stop points;
- backup/recovery assumptions.

Do not perform a rollback test against real `pos_db`.

Do not create experimental objects in real `pos_db`.

If rollback readiness depends on assumptions not yet proven, classify appropriately.

---

# 24. PHASE 17 — RISK CLASSIFICATION

Classify each prerequisite using exactly one of:

### PASS — VERIFIED

Evidence is sufficient and supports safe readiness.

### BLOCKER

A condition is known to prevent safe execution.

### NOT VERIFIED

Evidence is insufficient to establish readiness.

### INFORMATIONAL

Relevant observation with no current gate impact.

Do not use vague statuses such as:

- "probably okay";
- "looks fine";
- "should be safe";
- "likely ready".

---

# 25. REQUIRED PREFLIGHT MATRIX

Produce a matrix like:

| Domain | Check | Evidence | Status | Impact |
|---|---|---|---|---|
| DB Identity | Correct target DB | actual connection evidence | PASS/BLOCKER/NOT VERIFIED | ... |
| Baseline | 18 legacy tables | catalog query | ... | ... |
| Baseline | 17 rows | read-only count | ... | ... |
| Migration History | No partial Expand | migration metadata | ... | ... |
| Schema Drift | Current state matches pre-Expand baseline | diff | ... | ... |
| PostgreSQL | Version compatible | server version | ... | ... |
| Privileges | Migration role permissions | read-only verification | ... | ... |
| Locks | No blocking conditions | pg_stat_activity / locks | ... | ... |
| Backup | Current backup available | evidence | ... | ... |
| Recovery | Restore capability proven | evidence | ... | ... |
| Enum | Live vocabulary | pg_enum | ... | ... |
| Tenant Safety | tenant integrity | inspection | ... | ... |
| User Identity | Model B readiness | inspection | ... | ... |
| Product Mapping | SKU/barcode readiness | inspection | ... | ... |
| Runtime | Application quiescence plan | runtime inspection | ... | ... |
| Rollback | Rollback path understood | artifact + evidence | ... | ... |

Use actual observed values.

---

# 26. PHASE 18 — REPORT FINDINGS

Before any readiness gate decision, generate a detailed report covering:

## A. Executive Summary

What was checked and what the current readiness state is.

## B. Environment Identity

Exactly what database/runtime was inspected.

## C. Database Baseline

Actual current physical state.

## D. Migration History / Drift

Actual findings.

## E. Runtime Compatibility

PostgreSQL, privileges, locks, sessions, application state.

## F. Recovery Readiness

Actual backup/recovery evidence.

## G. Data / Identity Readiness

Actual findings for tenant, user, product, inventory, etc.

## H. Enum Readiness

Actual current enum state and compatibility handling.

## I. Risk Matrix

Every unresolved item.

## J. Evidence Limitations

What could not be verified.

## K. Recommendation for Gate

Only after all evidence has been compiled.

---

# 27. PHASE 19 — PRE-FLIGHT GATE

Apply the gate conservatively.

## GO — READY FOR EXPAND EXECUTION

Only if:

- target database identity is unambiguous;
- current database baseline is verified;
- no unexplained schema/migration drift exists;
- migration applicability is verified;
- no unexpected target object collisions exist;
- required PostgreSQL/runtime prerequisites are verified;
- migration privileges are sufficiently verified;
- lock/activity conditions are acceptable for the intended execution window;
- recovery/backup prerequisites are sufficiently evidenced according to project policy;
- known data safety prerequisites do not contain unresolved blockers;
- enum handling is consistent with the approved fail-closed design;
- no critical evidence gap remains.

AND:

**GO means readiness assessment only. It does NOT authorize migration execution.**

## BLOCKED — OWNER REVIEW REQUIRED

Use this gate if:

- any safety-critical prerequisite fails;
- database identity is ambiguous;
- schema/migration drift is unexplained;
- recovery capability is unverified where required;
- required privileges are unverified;
- active locks/runtime activity could make execution unsafe;
- data prerequisites contain unresolved blockers;
- enum state differs unexpectedly;
- evidence is materially incomplete.

## CONDITIONAL / OWNER REVIEW REQUIRED

Use this only if the project owner must explicitly accept a documented residual risk before execution and the risk does not invalidate the Expand artifact itself.

Do not silently convert conditional readiness into GO.

---

# 28. IMPORTANT DISTINCTION: READINESS ≠ AUTHORIZATION

Even if the gate says:

**READY FOR EXPAND EXECUTION**

do NOT:

- run Expand;
- execute Prisma migration;
- modify application runtime behavior;
- begin Backfill;
- begin Dual-write;
- begin Cutover;
- begin Contract;
- execute Prompt 13.2.

The result is a **readiness report** only.

A separate owner authorization must initiate the actual execution stage.

---

# 29. REQUIRED ARTIFACTS

Create/update:

`/docs/validation/14_PROMPT_13_1_RUNTIME_MIGRATION_PREFLIGHT.md`

`/docs/validation/14_PROMPT_13_1_RUNTIME_MIGRATION_PREFLIGHT_EVIDENCE.md`

`/docs/validation/14_PROMPT_13_1_FINAL_REPORT.md`

If the repository uses a different numbering convention already established after Prompt 12.6-E, preserve the repository's canonical naming convention instead of inventing a conflicting duplicate.

Do not overwrite a pre-existing artifact without first determining whether it is the authoritative version.

---

# 30. REQUIRED EVIDENCE

The evidence artifact must record:

- commands actually executed;
- files actually inspected;
- read-only SQL queries actually executed;
- actual outputs or concise relevant excerpts;
- database identity;
- migration history observations;
- schema drift observations;
- PostgreSQL/runtime observations;
- lock/activity observations;
- backup/recovery evidence;
- tenant/data prerequisite findings;
- enum state;
- exact blockers;
- exact unresolved items;
- final gate.

Never fabricate evidence.

Never claim a backup is valid merely because a path exists.

Never claim a restore works unless restore evidence actually exists.

---

# 31. DATABASE SAFETY ATTESTATION

At the end of Prompt 13.1, explicitly confirm:

- `pos_db` received zero DDL;
- `pos_db` received zero DML;
- no target tables were created;
- no transition columns were added;
- no live enums were altered;
- no indexes/FKs were created;
- no rows were changed;
- no reset/truncate/delete occurred;
- no Backfill occurred;
- no Dual-write occurred;
- no Cutover occurred;
- no Contract occurred;
- Prompt 13.2 was NOT executed.

Only state these as facts when supported by evidence from the actual execution.

---

# 32. FINAL OUTPUT FORMAT

Return exactly:

## 1. Executive Summary

## 2. Environment Identity

## 3. Files Inspected

## 4. Commands Executed

## 5. Database Baseline

## 6. Migration History & Schema Drift

## 7. Runtime / PostgreSQL Readiness

## 8. Locks / Active Transactions

## 9. Backup & Recovery Readiness

## 10. Enum Preflight

## 11. Tenant / Identity / Data Readiness

## 12. Product / Inventory Readiness

## 13. Risk & Blocker Matrix

## 14. Evidence Limitations

## 15. Database Safety Attestation

## 16. Final Gate

## 17. Explicit Confirmation: Expand / Prompt 13.2 NOT Executed

---

# 33. STOP CONDITION

STOP after delivering the Prompt 13.1 report.

Do not continue automatically.

The only permissible next state is:

```text
PROMPT 13.1 REPORT
       ↓
OWNER / INDEPENDENT REVIEW
       ↓
APPROVED NEXT STEP
```

Do not infer approval from a READY gate.

---

# 34. OPERATING PRINCIPLE

The purpose of Prompt 13.1 is not to prove that migration can be run.

The purpose is to determine whether the evidence is strong enough to justify a later, separately authorized execution.

Therefore:

```text
ACTUAL EVIDENCE
      >
ASSUMPTION

READ-ONLY VERIFICATION
      >
UNVERIFIED CLAIM

FAIL-CLOSED
      >
FALSE READINESS

READINESS
      ≠
AUTHORIZATION
```
