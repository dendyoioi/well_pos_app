# PROMPT 13.1A — ORDER_ITEMS PRECISION & RECOVERY BLOCKER ANALYSIS + OWNER DECISION

## DOCUMENT CONTROL

**Stage:** Prompt 13.1A — Blocker Analysis & Owner Decision  
**Parent Stage:** Prompt 13.1 — Runtime Migration Preflight & Execution Readiness  
**Mode:** READ-ONLY ANALYSIS + OWNER DECISION REQUEST  
**Migration Execution:** PROHIBITED  
**Live Schema Mutation:** PROHIBITED  
**Backup Creation:** PROHIBITED IN THIS STAGE UNLESS EXPLICITLY AUTHORIZED SEPARATELY  
**Backfill:** PROHIBITED  
**Dual-write:** PROHIBITED  
**Cutover:** PROHIBITED  
**Prompt 13.2:** PROHIBITED

---

# 1. ROLE

You are **Antigravity**, acting as:

**Lead Database & Systems Architect + Migration Safety Lead**

Your task is to analyze the two blockers found by Prompt 13.1, determine their exact technical and governance implications, and prepare an Owner Decision Record for the `order_items` precision mismatch and the missing physical backup.

This stage does NOT authorize implementation.

---

# 2. CONTEXT

Prompt 13.1 was executed successfully in strict read-only mode and produced:

## Blocker A — `order_items` precision mismatch

Actual `pos_db`:

- `order_items.cost_price` = `numeric(12,2) NOT NULL`
- `order_items.discount_amount` = `numeric(12,2) NOT NULL DEFAULT 0`

Current Expand migration preflight expects:

- `cost_price` = `numeric(15,4)`
- `discount_amount` = `numeric(15,2)`

The migration contains strict precision/scale compatibility assertions that will raise an exception if the actual existing column does not match the expected precision/scale.

Therefore Expand currently cannot execute cleanly against the current `pos_db`.

## Blocker B — Physical backup

Prompt 13.1 found:

- no verified `pg_dump` physical backup;
- restore capability therefore remains unverified;
- rollback.sql is available but is not a substitute for a verified database backup.

The project execution guardrails require a verified physical backup before live migration execution.

---

# 3. SOURCE OF TRUTH

Use:

1. Actual `pos_db` catalog/data
2. Executable `migration.sql`
3. Executable `rollback.sql`
4. Approved Target Database Schema Revision 4
5. Prisma schema
6. Owner Decisions ODR-01..ODR-06
7. Prompt 12.6-E evidence
8. Prompt 13.1 evidence
9. Execution Guardrails
10. Other documentation

Do not make an implementation decision from a previous report alone.

---

# 4. OBJECTIVE

Answer these questions with evidence:

### Question A
What is the correct treatment of the pre-existing `order_items.cost_price` and `order_items.discount_amount` columns?

### Question B
Does the chosen treatment preserve:

- target contract correctness;
- legacy compatibility;
- data safety;
- rollback safety;
- deterministic migration behavior;
- zero-loss semantics;
- future application/Prisma compatibility?

### Question C
What recovery/backup requirement must be satisfied before any live mutation or Expand execution?

---

# 5. EXECUTION PROTOCOL

Follow:

```text
READ
  ↓
UNDERSTAND
  ↓
VERIFY
  ↓
ANALYZE OPTIONS
  ↓
COMPARE IMPACT
  ↓
PREPARE OWNER DECISION
  ↓
STOP FOR OWNER DECISION
```

Do not implement anything in this stage.

---

# 6. PHASE 1 — READ

Inspect:

- `migration.sql`
- `rollback.sql`
- Target Database Schema Revision 4
- `schema.prisma`
- Prompt 13.1 Final Report
- Prompt 13.1 Runtime Preflight
- Prompt 13.1 Evidence
- `10_PROMPT_12_EXECUTION_GUARDRAILS.md`
- current application code that reads/writes `order_items.cost_price` and `discount_amount`

Also inspect actual current definitions in `pos_db`.

Do not infer missing content.

---

# 7. PHASE 2 — UNDERSTAND THE PRECISION CONFLICT

Establish the semantic purpose of each column:

## `cost_price`

Determine:

- source/legacy meaning;
- target meaning;
- current application assumptions;
- Prisma type;
- target schema type;
- whether scale 4 has business meaning;
- whether changing 12,2 → 15,4 changes existing values;
- whether widening precision/scale is lossless.

## `discount_amount`

Determine:

- source/legacy meaning;
- target meaning;
- current application assumptions;
- Prisma type;
- target schema type;
- whether 12,2 → 15,2 is widening-only;
- whether any application behavior depends on current definition.

---

# 8. PHASE 3 — ANALYZE ALL TREATMENT OPTIONS

Evaluate at least these options.

## OPTION A — Change migration compatibility rule

Modify the Expand preflight so the pre-existing legacy columns are accepted even though their physical precision differs.

Assess:

- resulting live schema after Expand;
- Prisma compatibility;
- Target Schema compliance;
- whether physical target precision remains 12,2;
- future writes requiring 15,4;
- rollback implications;
- whether this creates target contract drift.

Do not modify migration.sql during this stage.

---

## OPTION B — Align live legacy columns to target precision

Potential treatment:

- `order_items.cost_price` → `numeric(15,4)`
- `order_items.discount_amount` → `numeric(15,2)`

Assess:

- whether widening is lossless;
- whether PostgreSQL conversion is safe;
- whether NOT NULL/default constraints remain correct;
- whether application behavior changes;
- whether this is a migration prerequisite or should be part of Expand;
- rollback treatment;
- backup requirement before mutation.

Do not execute ALTER TABLE during this stage.

---

## OPTION C — Other architecturally valid treatment

Antigravity may identify a better treatment, but it must prove:

- why it is safer;
- how target contract remains consistent;
- how legacy compatibility is preserved;
- how rollback works;
- how the treatment remains deterministic.

Do not invent an option merely to avoid the blocker.

---

# 9. CRITICAL SAFETY QUESTION

Determine whether any proposed treatment requires a mutation of real `pos_db`.

If yes:

> **A verified physical backup MUST exist before the first live mutation.**

This safety rule supersedes the nominal sequence of later execution steps.

Do not perform a live ALTER and then create the backup afterward.

---

# 10. BACKUP REQUIREMENT

Define the exact backup evidence required.

At minimum evaluate:

- `pg_dump -Fc`;
- target DB identity;
- backup timestamp;
- file size;
- successful command exit code;
- archive integrity verification;
- restore verification strategy that does NOT mutate real `pos_db`.

Do not create the backup in this analysis stage.

Do not claim a backup exists without evidence.

---

# 11. OWNER DECISION PACKET

Produce an Owner Decision section containing:

## ODR-13.1A-01 — `order_items` Precision Treatment

Include:

- current actual types;
- target expected types;
- all evaluated options;
- technical consequences;
- rollback implications;
- recommended treatment only as an attributed technical recommendation, not an automatic authorization;
- exact implementation scope;
- exact files/tables/columns that would be changed;
- whether live DB mutation is required.

The Owner must choose one explicit treatment.

## ODR-13.1A-02 — Physical Backup Requirement

State:

- backup is mandatory before live migration execution;
- whether backup must also precede any live schema mutation;
- exact evidence required to mark backup READY.

---

# 12. FAIL-CLOSED CONDITIONS

Remain:

## BLOCKED / OWNER REVIEW REQUIRED

when:

- precision semantics are ambiguous;
- target contract implications are unclear;
- migration impact is uncertain;
- backup requirement is not satisfied;
- treatment has not been explicitly authorized by the Owner.

Do not resolve ambiguity by guessing.

---

# 13. REQUIRED ARTIFACT

Create:

`/docs/validation/14_PROMPT_13_1A_BLOCKER_ANALYSIS_OWNER_DECISION.md`

The artifact must include:

1. Executive Summary
2. Blocker A Evidence
3. Blocker B Evidence
4. Source Comparison
5. Treatment Options
6. Technical Impact Analysis
7. Recovery / Backup Requirements
8. Owner Decision Items
9. Explicit Non-Execution Statement
10. Gate = BLOCKED / OWNER REVIEW REQUIRED

---

# 14. STOP CONDITION

STOP after producing the Owner Decision packet.

Do NOT:

- change `migration.sql`;
- change `rollback.sql`;
- alter `pos_db`;
- create backup;
- run migration;
- run Prisma deploy;
- execute Prompt 13.2;
- perform any migration lifecycle phase.

The next step requires explicit Owner Decision.

---

# 15. FINAL RESPONSE FORMAT

Return:

## 1. Executive Summary
## 2. Blocker A — `order_items` Precision
## 3. Blocker B — Physical Backup
## 4. Treatment Options
## 5. Technical Recommendation
## 6. Owner Decision Required
## 7. Implementation Scope After Approval
## 8. Safety / Backup Prerequisites
## 9. Final Gate
## 10. Explicit Confirmation Nothing Was Mutated
