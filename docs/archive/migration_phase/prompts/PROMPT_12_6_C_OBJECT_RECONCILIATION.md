# PROMPT 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation

## 1. Document Control

- Stage: Prompt 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation
- Parent Stage: Prompt 12.6 — Target Schema & Expand Artifact Reconciliation after Owner Confirmation
- Purpose: Reconcile executable migration/rollback objects and protected legacy baseline evidence.
- Mode: STRICT READ-ONLY ANALYSIS / ARTIFACT RECONCILIATION ONLY
- Owner Decisions ODR-01 through ODR-06 remain FINAL and BINDING.
- No business decision reopening.
- No schema redesign.
- No migration execution.

## 2. Why This Micro-Correction Exists

Prompt 12.6 produced a final report claiming READY FOR OWNER REVIEW, but cross-artifact review identified unresolved evidence inconsistencies.

### C-01 — Target table inventory inconsistency

The Prompt 12.6 Final Report lists `price_histories` among the 18 target tables, while the reconciled executable object inventory lists 18 tables without `price_histories`.

Resolve this by deriving the actual object set directly from executable `migration.sql` and `rollback.sql`.

### C-02 — Protected legacy table inventory inconsistency

Different Prompt 12.6 artifacts enumerate different sets of 18 protected legacy tables.

Derive the authoritative protected set from executable migration/rollback protection logic and reconcile it against:
- object inventory,
- validation evidence,
- final report,
- safety test expectations.

### C-03 — Test pass is not sufficient by itself

The existing 102/102 result is positive evidence, but verify that the test suite covers the same executable object universe documented by the inventories and reports.

Mandatory invariant:

`EXECUTABLE OBJECTS = PREFLIGHT OBJECTS = OWNERSHIP OBJECTS = ROLLBACK OBJECTS = INVENTORY OBJECTS = VALIDATION OBJECTS = DOCUMENTED OBJECTS`

For protected legacy tables:

`ACTUAL PROTECTED BASELINE = MIGRATION PROTECTION = ROLLBACK PROTECTION = SAFETY TEST = INVENTORY = VALIDATION EVIDENCE = FINAL REPORT`

## 3. Source Hierarchy

Resolve contradictions using:

1. Executable `migration.sql`
2. Executable `rollback.sql`
3. Actual PostgreSQL catalog of `pos_db` — read-only
4. Target Schema Revision 4
5. Prisma target schema
6. Existing validation/preflight code
7. Ownership registry logic
8. Existing Prompt 12.6 artifacts
9. Generated reports

Do not silently select the most convenient version.

## 4. C-01 — Derive Actual Target Objects

Parse `migration.sql` and produce the exact executable inventory of:
- custom enum types
- target tables
- indexes
- foreign keys
- transition columns
- ownership registry
- auxiliary objects materially affecting ownership/rollback

For every object record:

`object_type, schema, object_name, parent_object, creation_mechanism, ownership_mechanism, rollback_mechanism, inventory_inclusion, validation_coverage`

Do not use a previously generated inventory as the source of truth.

## 5. C-02 — Derive Actual Rollback Objects

Parse `rollback.sql` and identify every object it can remove or alter.

For each:
- confirm corresponding migration scope;
- confirm ownership record;
- confirm rollback authorization;
- confirm teardown order;
- confirm no unrelated pre-existing object can be removed;
- confirm migration/rollback naming consistency.

Flag rollback-only objects and migration-only objects.

## 6. C-03 — Resolve `price_histories`

Determine whether `price_histories` is:
1. actual table created by migration;
2. Target Schema requirement not represented in migration;
3. legacy/pre-existing table;
4. documentation-only entry;
5. accidental inventory/report entry.

Required evidence:

```text
PRICE_HISTORIES
Actual executable status:
Target Schema status:
Prisma status:
Rollback status:
Ownership status:
Final classification:
Required artifact correction:
```

Do NOT create the table to resolve the discrepancy.

If Target Schema requires it but migration does not contain it, report BLOCKED. Do not silently add DDL.

## 7. C-04 — Derive Authoritative Protected Legacy Set

Inspect executable migration and rollback protection logic.

Derive the exact pre-existing legacy tables protected from:
- DROP
- TRUNCATE
- destructive ALTER
- accidental replacement
- rollback deletion

Compare:

| Legacy Table | Migration Guard | Rollback Guard | Safety Test | Object Inventory | Final Report | Result |
|---|---|---|---|---|---|---|

Any missing or extra table must be explained.

## 8. C-05 — Validate Safety Test Coverage

Inspect:
- `test_expand_safety.ts`
- `test_prompt_12_6_reconciliation.ts`

Determine:
- object counts asserted;
- exact names asserted;
- protected legacy tables asserted;
- whether all protected legacy tables are covered;
- whether counts are independently derived or hardcoded;
- whether tests could pass while inventory is wrong.

Do not modify tests in this prompt.

Incomplete coverage is an evidence gap/blocker.

## 9. C-06 — Ownership Registry Coverage

Reconcile every executable object against ownership registry logic.

Required matrix:

| Object | Created by migration? | Ownership state | Registry entry | Rollback action | Catalog identity check | Inventory |
|---|---|---|---|---|---|---|

No executable rollback-controlled object may be outside the ownership model.

## 10. C-07 — Count Reconciliation

Independently derive exact counts for:
- enums
- target tables
- indexes
- foreign keys
- transition columns
- protected legacy tables
- ownership registry
- rollback-controlled objects

Do not accept previously stated counts without deriving them.

## 11. Mandatory Matrix

Create:

`/docs/validation/13_PROMPT_12_6_C_OBJECT_RECONCILIATION_MATRIX.md`

Columns:

| Object Type | Object Name | Migration | Rollback | Preflight | Ownership | Safety Test | Inventory | Final Report | Status |
|---|---|---|---|---|---|---|---|---|---|

Allowed statuses:
- EXACT_MATCH
- MISSING_FROM_MIGRATION
- MISSING_FROM_ROLLBACK
- MISSING_FROM_PREFLIGHT
- MISSING_FROM_OWNERSHIP
- MISSING_FROM_TEST
- MISSING_FROM_INVENTORY
- MISSING_FROM_REPORT
- EXTRA_OBJECT
- CONFLICT
- BLOCKED

## 12. Mandatory Evidence Report

Create:

`/docs/validation/13_PROMPT_12_6_C_OBJECT_RECONCILIATION.md`

Include:
1. executable object derivation
2. rollback object derivation
3. `price_histories` resolution
4. protected legacy derivation
5. count reconciliation
6. ownership reconciliation
7. test coverage analysis
8. every discrepancy
9. resolution for every discrepancy
10. residual risks
11. final gate

## 13. Mandatory Provenance Report

Create:

`/docs/validation/13_PROMPT_12_6_C_OBJECT_EVIDENCE_PROVENANCE.md`

For each important inventory claim identify:

`Claim / Source file / Exact section or statement / Evidence type / Derived or declared / Cross-check result`

Distinguish executable, catalog, schema, test, and generated-document evidence.

## 14. Mandatory Validation Evidence

Create:

`/docs/validation/13_PROMPT_12_6_C_VALIDATION_EVIDENCE.md`

Include:
- commands actually executed;
- static inspection results;
- object extraction results;
- comparison results;
- safety-test coverage;
- read-only `pos_db` checks;
- explicit no-mutation confirmation.

Never claim a command was executed unless it actually was.

## 15. Safety Rules

STRICTLY FORBIDDEN:
- execute migration.sql or rollback.sql;
- execute Prisma migration/db push;
- execute DDL/DML against `pos_db`;
- reset/delete/truncate dummy data;
- Backfill;
- Dual-write;
- Cutover;
- Contract phase;
- production/staging changes;
- Prompt 13;
- create `price_histories` merely to resolve documentation;
- modify ODR-01 through ODR-06.

Read-only catalog and source inspection are allowed.

## 16. Dummy Data Policy

Existing `pos_db` contains prototype/dummy data.

This does NOT authorize reset/deletion in Prompt 12.6-C.

ODR-05 remains binding:
- legacy `stock_movements` dummy history is not historically backfilled;
- clean inventory initialization remains the approved future strategy;
- no data reset occurs in this prompt.

## 17. Acceptance Criteria

Pass only if:
- actual migration inventory is derived directly from executable migration;
- actual rollback inventory is derived directly from executable rollback;
- `price_histories` has definitive evidence-based classification;
- protected legacy set is identical across executable protection, tests, inventory, validation, and report;
- all counts reconcile;
- rollback-controlled objects have ownership coverage;
- migration-created objects have rollback classification;
- protected legacy tables have safety-test coverage;
- 102/102 is validated against actual executable object universe;
- ODR decisions remain unchanged;
- no DB mutation occurs;
- no migration phase beyond reconciliation occurs;
- all discrepancies are resolved or explicitly remain BLOCKED;
- final artifacts derive from reconciled evidence.

## 18. Final Gate

Only:
- `READY FOR OWNER REVIEW`
or
- `BLOCKED / OWNER REVIEW REQUIRED`

Do not recommend Prompt 13 if BLOCKED.

## 19. Final Report

Create:

`/docs/validation/13_PROMPT_12_6_C_FINAL_REPORT.md`

Include:
- Executive Summary
- Source Hierarchy
- Actual Executable Object Inventory
- Actual Rollback Inventory
- `price_histories` Resolution
- Protected Legacy Baseline
- Count Reconciliation
- Ownership Reconciliation
- Safety Test Coverage
- Cross-Artifact Matrix Summary
- Discrepancies and Resolutions
- Residual Risks
- Database Mutation Attestation
- Final Gate

Do not claim READY FOR OWNER REVIEW unless every acceptance criterion is satisfied.

## 20. Interpretation Rule

Do not "fix" a discrepancy by changing multiple artifacts until they agree.

First determine:

`WHAT IS ACTUALLY EXECUTABLE?`

Then reconcile documentation and validation evidence to that fact.

If executable migration conflicts with approved Target Schema Revision 4, report BLOCKED. Do not silently redesign migration under this prompt.

## 21. Expected Final Output

Return:
1. final gate;
2. authoritative object counts;
3. definitive `price_histories` classification;
4. definitive protected legacy table list;
5. all remaining discrepancies;
6. paths to generated artifacts.

Prompt 12.6-C ends at this gate. Do not begin Prompt 13.
