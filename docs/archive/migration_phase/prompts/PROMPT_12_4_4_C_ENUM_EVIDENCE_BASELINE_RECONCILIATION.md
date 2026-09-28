# PROMPT 12.4.4-C — ENUM EVIDENCE BASELINE RECONCILIATION

## Status
**OWNER-AUTHORIZED MICRO-CORRECTION — EVIDENCE / DOCUMENTATION ONLY**

## Context
Prompt 12.4.4 successfully hardened enum rollback with PostgreSQL catalog identity checks. However, the evidence artifacts contain a material baseline inconsistency that must be reconciled before the enum rollback gate can be accepted.

### Conflicting evidence
Prompt 12.4.3 ownership matrix records the following `pos_db` baseline states as **INCOMPATIBLE**:

- `PlatformRole`: `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`
- `TenantStatus`: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING`
- `InvoiceStatus`: `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED`
- `Role`: `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`
- `StockMovementType`: legacy prototype vocabulary
- `PaymentStatus`: `PAID`, `CANCELLED`, `REFUNDED`
- `PaymentMethod`: `CASH`, `QRIS`
- `PaymentTxStatus`: `SUCCESS`, `PENDING`, `FAILED`

Prompt 12.4.3 therefore classified these eight enums as **FAIL CLOSED / DO NOT DROP** because their catalog vocabulary did not exactly match Target Database Schema Revision 4.

Prompt 12.4.4 matrix, without documenting an intervening vocabulary migration, now classifies those same eight enums as **PRE_EXISTING_EXACT_COMPATIBLE_REUSED / PRESERVE** and reports a total of 10 pre-existing exact enums.

Prompt 12.4.4 is explicitly scoped to rollback catalog identity hardening and does not authorize changing enum vocabulary. Therefore the evidence must establish which state is being represented by the 12.4.4 matrix.

---

# 1. Objective

Reconcile the evidence baseline for all 20 Target Revision 4 enums without changing target schema definitions, enum vocabulary, legacy data, or migration behavior.

The result must make it unambiguous whether the 12.4.4 matrix represents:

1. the actual `pos_db` baseline before Expand,
2. an isolated disposable PostgreSQL validation fixture created by the 12.4.4 tests, or
3. another explicitly identified environment/state.

No state may be inferred merely from the current existence of an enum or from an exact catalog match.

---

# 2. Mandatory Evidence Rule

**Do not silently reconcile, correct, or overwrite the historical evidence.**

Preserve the original Prompt 12.4.3 evidence and Prompt 12.4.4 evidence. Add a new reconciliation artifact that explicitly explains the difference.

If the 12.4.4 matrix was generated from a test fixture rather than the real `pos_db`, relabel/document it as a **Validation Fixture State** and provide the fixture setup/provenance that produced the exact-compatible enums.

If the 12.4.4 matrix claims to describe the actual `pos_db` baseline, provide direct catalog evidence proving the eight formerly incompatible enums were already exact-compatible before the relevant migration step. If no such evidence exists, mark the claim **NOT VERIFIED** and do not represent those enums as pre-existing exact-compatible.

Do not fabricate historical evidence.

---

# 3. Scope — STRICT

## Allowed

- Inspect existing Prompt 12.4.3 and Prompt 12.4.4 reports/matrices.
- Inspect migration SQL, rollback SQL, test SQL/TypeScript, and test setup relevant to enum provenance.
- Inspect disposable/local validation database state if it is directly part of the Prompt 12.4.4 test evidence.
- Generate a reconciliation report/matrix.
- Generate a corrected copy or addendum to the Prompt 12.4.4 matrix if necessary, while preserving the original artifact.
- Add tests that validate evidence labeling/provenance only.

## Forbidden

- Do NOT modify Target Database Schema Revision 4.
- Do NOT change the 20 target enum labels or order.
- Do NOT ALTER TYPE / ADD VALUE / rename enum labels.
- Do NOT migrate legacy enum vocabulary.
- Do NOT execute Expand against staging or production.
- Do NOT execute Backfill.
- Do NOT implement Dual-write.
- Do NOT execute Cutover.
- Do NOT execute Contract.
- Do NOT start Prompt 13.
- Do NOT change rollback authorization logic merely to make the evidence pass.
- Do NOT classify an enum as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` solely because it is exact in a disposable test database.
- Do NOT delete or overwrite the original 12.4.3 or 12.4.4 evidence artifacts.

---

# 4. Required Investigation

Antigravity MUST trace the provenance of the 12.4.4 matrix entries.

For each of the 20 enums, determine and document:

- target enum contract;
- Prompt 12.4.3 baseline state;
- Prompt 12.4.4 reported state;
- environment/database represented by the evidence;
- whether the enum existed before the migration/test fixture;
- whether it was created by Prompt 12.4.2/12.4.4 test setup;
- registry provenance, if applicable;
- exact catalog labels/order observed;
- evidence source and artifact reference;
- final reconciled evidence status.

The eight historically disputed enums require explicit treatment:

`PlatformRole`, `TenantStatus`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`.

---

# 5. Environment Separation Requirement

The report MUST distinguish at minimum:

### A. Historical / real legacy baseline
The `pos_db` state represented by Prompt 12.4.3.

### B. Disposable validation fixture
The `pos_test_disposable_prompt12_4` environment used by Prompt 12.4.4, if confirmed.

### C. Migration-created state
Any state created by the Expand migration or test setup.

An exact enum in B or C does **not** prove that the same enum was exact in A.

---

# 6. Fixture Provenance Requirement

If the 12.4.4 matrix is a disposable validation fixture, document exactly how its 10 pre-existing enums acquired their exact Target Revision 4 vocabulary.

At minimum identify:

- fixture database name;
- setup script/test file;
- SQL or code responsible for enum creation/seeding;
- whether the enum was copied from Target Revision 4, pre-seeded manually, or created by migration;
- whether registry provenance was pre-seeded;
- whether the fixture is intended to model legacy `pos_db` or only rollback test conditions.

If the evidence does not establish this, mark the provenance **NOT VERIFIED**.

---

# 7. Historical Evidence Preservation

The reconciliation MUST NOT rewrite history.

Use the following interpretation rules:

- Prompt 12.4.3 matrix remains the historical baseline evidence it originally reported.
- Prompt 12.4.4 matrix remains the artifact it originally reported.
- A new reconciliation artifact explains whether their environments differ.
- Any corrected interpretation must be stated as a reconciliation conclusion, not silently substituted into the original artifact.

---

# 8. Required Reconciliation Matrix

Create:

`/docs/validation/10_PROMPT_12_4_4_C_ENUM_EVIDENCE_BASELINE_RECONCILIATION.md`

The matrix MUST contain at least:

| Enum | Prompt 12.4.3 `pos_db` Baseline | Prompt 12.4.4 Reported State | Environment | Provenance Evidence | Reconciled Status | Rollback Implication |
|---|---|---|---|---|---|---|

Allowed reconciled statuses:

- `VERIFIED_HISTORICAL_BASELINE`
- `VERIFIED_VALIDATION_FIXTURE`
- `VERIFIED_MIGRATION_CREATED`
- `NOT_VERIFIED`
- `CONTRADICTORY_EVIDENCE`
- `NOT_APPLICABLE`

Do not use `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` as a reconciled status unless historical provenance is actually proven.

---

# 9. Required Conclusion Rules

The report MUST explicitly answer:

1. Does Prompt 12.4.4 actually prove that the eight previously incompatible `pos_db` enums became exact-compatible?
2. If not, is the 12.4.4 matrix merely a disposable validation fixture state?
3. What exact evidence establishes the fixture's enum provenance?
4. Does the inconsistency affect rollback catalog-identity tests?
5. Does it affect the real Expand migration readiness for `pos_db`?
6. Which enums are safe to classify as pre-existing exact-compatible for the real database?
7. Which enums remain fail-closed / unverified for the real database?

The report MUST distinguish:

- **rollback implementation correctness**, and
- **real-database baseline readiness**.

A passing disposable rollback test must not be presented as proof of real legacy-database enum compatibility.

---

# 10. Required Validation Tests

Add or run evidence-focused checks as appropriate:

- `EBC-01`: Prompt 12.4.3 and 12.4.4 matrices are both preserved and referenced.
- `EBC-02`: Environment/database identity is explicit.
- `EBC-03`: Fixture setup provenance is traceable.
- `EBC-04`: No exact fixture match is used as historical provenance proof.
- `EBC-05`: Eight disputed enums are individually reconciled.
- `EBC-06`: Ten undisputed fixture-created/previously exact enums are individually reconciled.
- `EBC-07`: No enum vocabulary is modified by this prompt.
- `EBC-08`: No rollback authorization is broadened by this prompt.
- `EBC-09`: Original evidence artifacts are not overwritten.
- `EBC-10`: Final report clearly separates fixture state from real `pos_db` state.

All applicable tests MUST PASS.

---

# 11. Required Artifacts

Produce:

1. `/docs/validation/10_PROMPT_12_4_4_C_ENUM_EVIDENCE_BASELINE_RECONCILIATION.md`
2. If needed, a clearly named corrected/addendum matrix, without deleting the original 12.4.4 matrix.
3. Evidence/test output showing the environment and provenance of the 12.4.4 matrix.
4. A final execution summary.

Do not modify the original Prompt 12.4.3 or Prompt 12.4.4 reports/matrices.

---

# 12. Gate

The only acceptable final statuses for this micro-correction are:

### `READY FOR OWNER REVIEW`
All contradictory evidence is reconciled and the environment/provenance distinction is fully documented.

### `BLOCKED / OWNER REVIEW REQUIRED`
Historical evidence cannot be reconciled from available artifacts, or the 12.4.4 matrix cannot be proven to represent the stated environment.

Do NOT report `READY` merely because the rollback tests pass.

---

# 13. Final Output Format

Antigravity MUST return:

```text
PROMPT 12.4.4-C — ENUM EVIDENCE BASELINE RECONCILIATION

Environment(s) inspected:
- ...

Historical baseline:
- ...

Prompt 12.4.4 fixture/report state:
- ...

Eight disputed enums:
- ...

Fixture provenance:
- ...

Evidence reconciliation:
- ...

Tests:
- EBC-01: PASS/FAIL
- EBC-02: PASS/FAIL
- ...
- EBC-10: PASS/FAIL

Artifacts created:
- ...

Changes to schema/migration behavior:
- NONE

Backfill executed: NO
Dual-write executed: NO
Cutover executed: NO
Contract executed: NO
Prompt 13 started: NO

Final Gate:
READY FOR OWNER REVIEW / BLOCKED — OWNER REVIEW REQUIRED
```

## Owner Boundary

This prompt does **not** authorize proceeding to Prompt 13.

After completion, stop and return the evidence for owner review.
