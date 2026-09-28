# PROMPT 12.6-D — Reconciliation Test Baseline Correction

## 1. Document Control

- Stage: Prompt 12.6-D — Reconciliation Test Baseline Correction
- Parent Stage: Prompt 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation
- Purpose: Correct the obsolete protected-legacy baseline in `test_prompt_12_6_reconciliation.ts` and revalidate the reconciliation evidence.
- Mode: CONTROLLED IMPLEMENTATION + VALIDATION
- Owner Decision: Prompt 12.6-C points 1–3 CONFIRMED.
- ODR-01 through ODR-06 remain FINAL and BINDING.

## 2. Owner Confirmations

The Owner has explicitly confirmed:

1. `price_histories` is an accidental documentation entry and is NOT part of Phase 1 Target Schema.
2. The authoritative protected legacy baseline is exactly the following 18 tables:

```text
categories
customers
hold_orders
order_items
orders
outlet_products
outlets
payments
platform_users
products
saas_invoices
saas_payments
shifts
stock_movements
subscription_plans
tenant_subscriptions
tenants
users
```

3. Authorization is granted to correct `test_prompt_12_6_reconciliation.ts` so that its protected legacy baseline reflects the authoritative 18-table set.

## 3. Scope

This prompt exists only to remove the stale test baseline identified in Prompt 12.6-C.

### In scope

- Inspect `test_prompt_12_6_reconciliation.ts`.
- Replace the obsolete protected-table array/list with the authoritative 18-table baseline.
- Ensure the test checks every one of the 18 real protected tables.
- Ensure none of the six phantom/speculative tables remain in the protected baseline:
  - `cash_movements`
  - `discounts`
  - `taxes`
  - `printers`
  - `kitchen_stations`
  - `modifiers`
- Ensure the seven previously omitted real tables are covered:
  - `outlets`
  - `saas_invoices`
  - `saas_payments`
  - `platform_users`
  - `outlet_products`
  - `hold_orders`
  - `subscription_plans`
- Re-run the affected reconciliation tests.
- Re-run `test_expand_safety.ts`.
- Reconcile the resulting counts and assertions against Prompt 12.6-C evidence.
- Update only validation/evidence artifacts required to reflect the corrected test baseline.

### Out of scope

Do NOT:
- modify `migration.sql`;
- modify `rollback.sql`;
- modify Target Schema Revision 4;
- modify Prisma target schema;
- modify ODR-01 through ODR-06;
- modify application business logic;
- modify database data;
- execute migration;
- execute rollback;
- execute Prisma migration/db push;
- reset/truncate/delete dummy data;
- perform Backfill;
- perform Dual-write;
- perform Cutover;
- perform Contract phase;
- start Prompt 13;
- add `price_histories`;
- remove any actual database table.

## 4. Source-of-Truth Hierarchy

Use:

1. Owner-confirmed Prompt 12.6-C decisions
2. Executable `migration.sql` / `rollback.sql`
3. Actual `pos_db` catalog
4. Prompt 12.6-C authoritative protected legacy baseline
5. Existing test code
6. Derived validation documentation

Do not derive the protected baseline from the obsolete test array.

## 5. Required Implementation

Locate the protected legacy table baseline in:

```text
test_prompt_12_6_reconciliation.ts
```

Replace the obsolete list with exactly:

```ts
[
  'categories',
  'customers',
  'hold_orders',
  'order_items',
  'orders',
  'outlet_products',
  'outlets',
  'payments',
  'platform_users',
  'products',
  'saas_invoices',
  'saas_payments',
  'shifts',
  'stock_movements',
  'subscription_plans',
  'tenant_subscriptions',
  'tenants',
  'users',
]
```

Preserve the test's existing assertion semantics unless a minimal adjustment is necessary to ensure all 18 tables are actually validated.

Do not refactor unrelated tests.

## 6. Mandatory Static Checks

After the change, verify:

### S-01
No occurrence of the six obsolete protected-table names remains in the active protected baseline:

```text
cash_movements
discounts
taxes
printers
kitchen_stations
modifiers
```

Note: a test or documentation may legitimately mention these names as historical phantom/obsolete values. The requirement is that they must not remain as members of the authoritative protected-table assertion array.

### S-02
All 18 authoritative protected tables are asserted.

### S-03
No authoritative table is duplicated.

### S-04
No unrelated table is added.

### S-05
`price_histories` remains absent from migration/schema/test target object contracts.

## 7. Mandatory Tests

Run the existing test suites relevant to this correction.

At minimum:

```bash
npx tsx src/migrations/test_prompt_12_6_reconciliation.ts
npx tsx src/migrations/test_expand_safety.ts
```

If the repository exposes an additional dedicated Prompt 12.6 validation command, it may be run read-only.

Do not claim a test passed unless its actual command output was observed.

## 8. Expected Test Semantics

The corrected reconciliation suite must demonstrate:

- the 18 actual legacy tables are protected;
- no actual legacy table is missing from the protected baseline;
- phantom/speculative tables are not treated as protected baseline objects;
- target migration object counts remain unchanged;
- rollback object counts remain unchanged;
- no destructive migration operation has been introduced;
- no schema object has been added merely to satisfy a test.

Expected object counts remain:

```text
Ownership Registry       1
Target Custom Enums     20
Target Core Tables      18
Transition Columns      23
Target Indexes          34
Target Foreign Keys     40
Transition Foreign Keys  2
Protected Legacy        18
```

If any count changes unexpectedly, STOP and report BLOCKED.

## 9. Required Evidence

Create/update:

### A.
`/docs/validation/13_PROMPT_12_6_D_TEST_BASELINE_CORRECTION.md`

Must include:
- owner authorization;
- before/after protected baseline;
- exact code location changed;
- rationale;
- test commands;
- observed outputs;
- object count verification;
- no database mutation statement;
- final gate.

### B.
`/docs/validation/13_PROMPT_12_6_D_VALIDATION_EVIDENCE.md`

Must include:
- static scan results;
- exact protected-table assertion coverage;
- test outputs;
- migration/rollback static safety results;
- no-mutation verification.

### C.
`/docs/validation/13_PROMPT_12_6_D_FINAL_REPORT.md`

Must include:
- Executive Summary
- Owner Authorization
- Change Performed
- Protected Legacy Baseline
- Before vs After
- Test Results
- Object Count Reconciliation
- Safety Verification
- Residual Risks
- Final Gate

## 10. Database Safety

The real `pos_db` must remain unchanged.

Verify after testing:

- total table count unchanged;
- ownership registry remains absent from `pos_db`;
- row counts remain unchanged;
- no migration-created target tables exist in `pos_db`.

Do not use a destructive command to perform this verification.

## 11. Gate Conditions

### READY FOR OWNER REVIEW

Only if:

- test baseline is corrected exactly;
- all 18 tables are covered;
- no obsolete table remains in active baseline;
- `test_prompt_12_6_reconciliation.ts` passes;
- `test_expand_safety.ts` passes;
- object counts remain unchanged;
- no migration/rollback/schema changes occurred;
- `pos_db` remains untouched;
- evidence artifacts are updated;
- no unresolved blocker remains.

### BLOCKED / OWNER REVIEW REQUIRED

Use this gate if:
- any test fails;
- counts change;
- migration/rollback changes are unexpectedly required;
- database state changes;
- protected baseline cannot be reconciled;
- unrelated code changes are required.

## 12. Final Restrictions

Prompt 12.6-D ends at its own gate.

Do not:
- start Prompt 13;
- execute migration;
- execute rollback;
- perform Backfill;
- perform Dual-write;
- perform Cutover;
- perform Contract;
- reset dummy data.

## 13. Expected Final Output

Return:

1. Final Gate
2. Exact file changed
3. Before/after protected baseline
4. Test results
5. Object counts
6. Database no-mutation verification
7. Paths to all generated/updated artifacts

Stop after the final gate.
