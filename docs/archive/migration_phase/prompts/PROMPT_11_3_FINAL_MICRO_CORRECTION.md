# PROMPT 11.3 --- FINAL MICRO-CORRECTION

## Migration Readiness Report --- Final Gate Correction

**Project:** Well POS / `pos_apps`\
**Purpose:** Final narrow correction of the Migration Readiness Report
only\
**Mode:** READ-ONLY / REPORT-ONLY\
**Status:** FINAL MICRO-CORRECTION\
**Do NOT proceed to Prompt 12**

------------------------------------------------------------------------

## 1. ROLE

You are **Antigravity**, acting as the implementation/architecture agent
for Well POS.

This task is a **final micro-correction** to the migration readiness
report produced in Prompt 11.2.

The architecture and target schema are already approved. Do not reopen
architecture decisions.

Your task is only to correct the three remaining material issues below
in:

`/docs/validation/09_MIGRATION_READINESS_REPORT.md`

------------------------------------------------------------------------

## 2. REQUIRED SOURCE OF TRUTH

Before editing, read and use:

1.  `/docs/validation/09_MIGRATION_READINESS_REPORT.md`
2.  `/docs/04_TARGET_DATABASE_SCHEMA(3).md` --- Target Database Schema
    Revision 4
3.  The approved ADR-002 negative-stock decision / corresponding
    architecture documentation

Follow the existing approved terminology and architecture.

Do not silently introduce new schema fields, new entities, or new
architecture decisions.

------------------------------------------------------------------------

# 3. MANDATORY CORRECTIONS

## C-02 --- Legacy PIN NULL Handling Must Match Target Schema

### Problem

The current report states, in substance, that when legacy
`users.pin IS NULL`, migration should:

> generate a temporary random 6-digit PIN, hash it, and set the user
> account to require PIN change upon first authentication.

This is not compatible with the approved Target Schema Revision 4.

### Required correction

The target `User` model contains:

-   `tenantId`
-   `outletId`
-   `userCode`
-   `name`
-   `email`
-   `passwordHash`
-   `pinHash`
-   `role`
-   `isActive`
-   `lastLoginAt`
-   `createdAt`
-   `updatedAt`

There is **no** target field such as:

-   `mustChangePin`
-   `forcePinReset`
-   `pinResetRequired`
-   or equivalent credential-state column.

Therefore:

### For legacy `pin IS NOT NULL`

State that:

-   the legacy PIN representation must first be verified;
-   if it is confirmed to be plaintext or otherwise recoverable as a
    credential value, it must be transformed into the approved
    `User.pinHash` representation using the approved password/PIN
    hashing mechanism;
-   migration success requires a valid non-null `User.pinHash`.

### For legacy `pin IS NULL`

Do **not** invent a target schema field.

Instead state:

-   the user requires credential provisioning/reset through an
    **approved migration or operational procedure**;
-   the procedure may generate or assign a temporary credential, but
    this is an operational process, not a new schema field;
-   the target success condition remains `User.pinHash IS NOT NULL`
    after approved provisioning;
-   if the legacy PIN representation itself is unknown or cannot be
    safely interpreted, classify it as:

`LEGACY PIN REPRESENTATION NOT VERIFIED`

and require verification before migration.

Do not claim that the target schema supports a forced PIN-change flag.

------------------------------------------------------------------------

## C-04 --- Correct Inventory Reconciliation Formula

### Problem

The current report contains a reconciliation formula conceptually
equivalent to:

``` text
legacy stock != target InventoryBalance.quantityOnHand / ProductVariant.inventoryQuantityMultiplier
```

This is incorrect.

### Required architectural rule

The approved Target Schema defines:

``` text
InventoryBalance.quantityOnHand
```

as the **canonical physical stock baseline**.

The field:

``` text
ProductVariant.inventoryQuantityMultiplier
```

is a **transaction conversion multiplier**.

The approved rule is:

``` text
Canonical Inventory Consumed
    =
Order Quantity
×
ProductVariant.inventoryQuantityMultiplier
```

Therefore, do **not** divide physical `InventoryBalance.quantityOnHand`
by the multiplier.

### Required reconciliation wording

For the default legacy mapping where the migrated ProductVariant uses:

``` text
inventoryQuantityMultiplier = 1.000
```

the physical opening-stock reconciliation must be:

``` text
legacy outlet_products.stock
=
target InventoryBalance.quantityOnHand
```

with reconciliation dimensions:

``` text
tenant
+
legacy Outlet → target StorageLocation
+
legacy Product → target InventoryItem
+
batch, when applicable
+
UOM, when applicable
```

The report must separately validate transaction conversion where a
multiplier is applicable:

``` text
Order Quantity
×
ProductVariant.inventoryQuantityMultiplier
=
physical inventory quantity deducted
```

### Important

Do not redefine the physical inventory baseline using the multiplier.

Do not use:

``` text
quantityOnHand / multiplier
```

for opening-stock reconciliation.

The multiplier affects **transaction consumption**, not the canonical
physical stock quantity.

------------------------------------------------------------------------

## C-05 --- Negative Stock Must Distinguish Permitted vs Not Permitted

The report must explicitly distinguish the two cases.

### Case A --- Negative stock is permitted

If the approved tenant/location/item policy permits negative stock:

-   preserve the negative `InventoryBalance.quantityOnHand`;
-   create the corresponding immutable `InventoryLedger` movement;
-   set:

``` text
InventoryLedger.isNegativeBalance = true
```

for the relevant negative-balance ledger state.

Do not introduce any `InventoryBalance.isNegativeBalance` field.

### Case B --- Negative stock is not permitted

If negative stock is not permitted by the applicable policy:

-   do **not** simply migrate the negative quantity and continue as if
    valid;
-   classify the record as a **migration exception requiring manual
    resolution**;
-   resolve the discrepancy according to the approved migration
    procedure before declaring the relevant reconciliation scope
    successful.

Use the approved negative-stock hierarchy:

``` text
Tenant
→ StorageLocation
→ InventoryItem
```

The report must make clear that the applicable policy is evaluated at
these levels according to the approved ADR-002 rules.

### Important schema constraint

Do not add or refer to:

``` text
InventoryBalance.isNegativeBalance
```

The approved target schema has no such field.

The negative-balance indicator belongs to:

``` text
InventoryLedger.isNegativeBalance
```

------------------------------------------------------------------------

# 4. NON-GOALS / HARD CONSTRAINTS

During this task:

-   Do NOT modify Prisma schema.
-   Do NOT modify application code.
-   Do NOT create migration files.
-   Do NOT run database migrations.
-   Do NOT modify database data.
-   Do NOT modify seed data.
-   Do NOT create new models or fields.
-   Do NOT introduce `UserOutletAssignment`.
-   Do NOT introduce a PIN-reset flag.
-   Do NOT change the approved Product → ProductVariant → InventoryItem
    target architecture.
-   Do NOT change the approved inventory quantity model.
-   Do NOT reinterpret `inventoryQuantityMultiplier`.
-   Do NOT change ADR decisions.
-   Do NOT start Prompt 12.
-   Do NOT implement any migration.

This is a **report-only correction**.

------------------------------------------------------------------------

# 5. PRESERVE ALL VALID CONTENT FROM PROMPT 11.2

Do not rewrite the report unnecessarily.

Preserve the already-corrected conclusions from Prompt 11.2, including:

-   tenant isolation architecture;
-   tenant fallback as a current application / cutover risk;
-   ProductVariant ownership of SKU/barcode;
-   Product 1:N ProductVariant and ProductVariant N:1 InventoryItem;
-   legacy 1:1:1 mapping as a migration mapping only;
-   InventoryLedger as an immutable append-only stock movement ledger;
-   reconciliation dimensions by tenant/location/item/batch/UOM where
    applicable;
-   parked-order retention as Owner Decision Required;
-   exact userCode format as Owner Decision Required;
-   live-data counts as NOT VERIFIED unless actually verified;
-   no UserOutletAssignment in Phase 1;
-   no unsupported composite-FK claims for Phase 1.

Only correct the three remaining issues described in this prompt.

------------------------------------------------------------------------

# 6. REQUIRED FINAL GATE

After applying the corrections, re-read the complete report and verify
that it contains no contradiction with:

-   Target Database Schema Revision 4;
-   approved ADR-002;
-   the established migration architecture.

The final migration readiness gate must remain exactly one of:

``` text
GO
GO WITH CONDITIONS
NO-GO
```

Do not change the gate merely because of this micro-correction unless
the corrected evidence logically requires it.

If the gate remains `GO WITH CONDITIONS`, preserve that conclusion and
its conditions.

------------------------------------------------------------------------

# 7. OUTPUT REQUIREMENT

Modify only:

``` text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

At the end of your response, report:

1.  Which three corrections were applied.
2.  The final gate: `GO`, `GO WITH CONDITIONS`, or `NO-GO`.
3.  Confirmation that no schema, application, database, or migration
    changes were made.
4.  Confirmation that Prompt 12 was **not** started.

Then **STOP**.

Do not propose or execute Prompt 12 automatically.
