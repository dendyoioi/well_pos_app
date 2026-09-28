# PROMPT 13.3C-CORRECTION — LIVE BACKFILL SAFETY CONTRACT & AUTHORIZATION PACKAGE REPAIR

**Document ID:** `VAL-PROMPT-13-3C-AUTH-PKG-002-REDACTED`  
**Execution Timestamp:** 2026-09-21T01:37:00+07:00  
**Phase:** Target Schema Expand Phase — Safety Remediation & Owner Authorization Packaging  
**Target Database:** `pos_db` (Quiescent / Offline / Strictly Unmutated)  
**Safety Classification:** Strictly Source-Code Remediation, Disposable Validation, & Packaging  
**Final Gate:** `READY FOR OWNER AUTHORIZATION — LIVE BACKFILL NOT YET EXECUTED`

---

## 1. EXECUTIVE SUMMARY & REPAIR OBJECTIVES

In accordance with `PROMPT 13.3C-CORRECTION` and `PROMPT 13.3C-SECURITY-REDACTION-CORRECTION`, all safety semantics, authorization package instructions, lifecycle references, and credential redactions have been completed:

1. **ACID Transaction Failure Semantics in Source:**
   - Implemented strict per-tenant-batch ACID transaction boundaries (`prisma.$transaction`) in `server/src/migrations/backfill/index.ts`.
   - Updated all 10 workers to fail closed on any live mutation error (`if (!context.isDryRun) throw err;`), immediately aborting the active transaction, triggering PostgreSQL `ROLLBACK`, and halting subsequent tenant batches or workers.
   - Added `failureInjectionWorker` hook to `BackfillContext` and proved atomic rollback on an isolated disposable database: 0 partial rows persisted after failure injection.
2. **Sanitized Authorization Package:**
   - Removed all plaintext database credentials, passwords, and hardcoded connection strings. All operational commands strictly use environment variable placeholders (`${DATABASE_URL}`, `${PGPASSWORD}`, `${PGHOST}`, `${PGPORT}`, `${PGUSER}`).
   - Removed all instructions that drop, recreate, or restore directly over `pos_db`. Described disaster recovery exclusively as an Owner-authorized, separately controlled restore procedure.
3. **Elimination of Plaintext PIN Exposure (Security Redaction):**
   - Removed every plaintext PIN literal from documentation, test scripts, and log outputs.
   - Replaced all credential evidence with non-secret classifications:
     - `LEGACY_PIN_PRESENT` / `LEGACY_PIN_NULL`;
     - `hash generated = yes/no`;
     - `bcrypt format valid = yes/no`;
     - `pin_hash remains NULL = yes/no`.
   - Implemented automated static security scan that fails closed if any new artifact contains plaintext PIN literals or direct PIN logging.
4. **Corrected OD-13.3-03 Invariant Handling:**
   - Conducted direct audit of physical baseline users in `pos_db`:
     - User `e2dce666-fe56-4b47-a39f-9ca911528fef` (Rudra, ADMIN): `classification = LEGACY_PIN_PRESENT`.
     - User `84f253ff-9f3f-4273-9ed5-621ace395198` (Dian Anjani, CASHIER): `classification = LEGACY_PIN_PRESENT`.
     - Baseline physical PIN-less count (`LEGACY_PIN_NULL`): **0**.
   - Explicitly updated the mutation inventory: any PIN-less user (`LEGACY_PIN_NULL`) strictly receives `pin_hash = NULL` (`pin_hash remains NULL = yes`, zero synthetic credentials).
   - Hardened `reconcile_user_credentials.ts` to allow `pin_hash = NULL` ONLY where legacy PIN is `LEGACY_PIN_NULL`, while strictly enforcing non-null `user_code`, `hash generated = yes`, and `bcrypt format valid = yes` for users with `LEGACY_PIN_PRESENT`.
5. **Corrected Lifecycle Transition Wording:**
   - Completely purged all occurrences of "READY FOR CONTRACT STAGE" from source (`reconcile_all.ts`) and documentation.
   - Formalized next gate as **"POST-BACKFILL RECONCILIATION REVIEW & DUAL-WRITE AUTHORIZATION PLANNING"**.
6. **Production Database (`pos_db`) Integrity:**
   - Verified that `pos_db` remains 100% pristine (0 target rows, 17 legacy rows intact, application quiescent, 0 Prisma client generation).

---

## 2. STATIC SECURITY REDACTION SCAN EVIDENCE

An automated static security scanner (`TEST 0` in `test_prompt_13_3c_failure_injection.ts`) was executed across all migration sources, test runners, and reports:

- Scanned files:
  - `docs/validation/18_PROMPT_13_3C_DRY_RUN_VALIDATION_AND_OWNER_AUTHORIZATION_PACKAGE.md`
  - `server/src/migrations/test_prompt_13_3c_failure_injection.ts`
  - `server/src/migrations/test_prompt_13_3b_verification.ts`
  - All 10 worker files in `server/src/migrations/backfill/`
  - All 6 reconciliation checker files in `server/src/migrations/reconciliation/`
- Scan criteria:
  - Detection of known legacy PIN literal;
  - Detection of `pin=${...}`, `pin: ${...}`, or `pin="${...}"` logging/interpolation;
  - Direct logging of `user.pin` or equivalent raw secret fields.
- **Scan Result:** **PASSED (0 security violations detected across 19 artifacts).**

---

## 3. SOURCE-CODE ACID TRANSACTION & FAIL-CLOSED REMEDIATION

### 3.1 Architecture of the ACID Transaction Boundary
In `server/src/migrations/backfill/index.ts`, execution is partitioned into:
- **Dry-Run Mode (`isDryRun: true`):** Runs read-only inspection queries across the entire tenant space to compute deterministic mutation counts and identifier mappings without mutations.
- **Live Execution Mode (`isDryRun: false`):** Iterates over distinct tenant IDs and wraps the entire 10-worker sequence for each tenant in an atomic PostgreSQL transaction:

```typescript
// server/src/migrations/backfill/index.ts
for (const currentTenantId of tenantBatches) {
  context.logger.info(`Beginning ACID transaction for tenant batch: ${currentTenantId || 'ALL'}`);
  const tenantContext: BackfillContext = {
    ...context,
    tenantId: currentTenantId,
  };

  await prisma.$transaction(
    async (tx) => {
      const batchResults = await executeWorkerPipeline(tx, tenantContext);
      results.push(...batchResults);
    },
    { timeout: 60000 }
  );
  context.logger.info(`Committed ACID transaction for tenant batch: ${currentTenantId || 'ALL'}`);
}
```

### 3.2 Worker Fail-Closed Rethrow Contract
Every worker (01 to 10) was updated to accept `prisma: any` (supporting both `PrismaClient` and `Prisma.TransactionClient` `tx`). When `!context.isDryRun`:
```typescript
} catch (err: any) {
  context.logger.error(`Error in ${result.workerName}`, err);
  result.errorCount++;
  result.exceptions.push({
    recordId: recordId,
    reason: err.message,
  });
  if (!context.isDryRun) {
    throw err; // Aborts transaction, triggers PostgreSQL ROLLBACK, halts execution
  }
}
```
No silent catch-and-continue is permitted during live mutation.

---

## 4. DISPOSABLE DATABASE FAILURE-INJECTION & ROLLBACK EVIDENCE

A dedicated validation suite (`server/src/migrations/test_prompt_13_3c_failure_injection.ts`) was executed against an isolated disposable database fixture (`pos_test_disposable_prompt13_3c`), cloned directly from `pos_db`.

### 4.1 Failure-Injection Test Execution
1. **Initial Baseline:** All target tables verified at 0 rows.
2. **Intentional Fault Injection:** Backfill launched with `isDryRun: false` and `failureInjectionWorker: '03_inventory_items'`.
3. **Execution Sequence:**
   - Worker 01 (`01_tenant_audit`) executed clean audit.
   - Worker 02 (`02_storage_locations`) executed live `INSERT` for 2 storage locations.
   - Worker 03 (`03_inventory_items`) intercepted `failureInjectionWorker`, throwing `FAILURE_INJECTION_TRIGGERED: Injected fatal mutation error in worker 03_inventory_items`.
4. **Transaction Abort & Rollback:**
   - The transaction client aborted the block.
   - PostgreSQL executed an immediate `ROLLBACK`.
   - The orchestrator caught the fatal error and re-threw (`fail closed`), preventing workers 04 through 10 from executing.

### 4.2 Evidence of Zero Partial Rows Persisted
Physical row counts measured immediately following the aborted transaction:

| Target Table | Rows Inserted Prior to Fault | Post-Rollback Physical Count | Rollback Status |
|---|---|---|---|
| `storage_locations` | 2 (Worker 02) | **0** | **100% ROLLED BACK (Zero Partial Rows)** |
| `inventory_items` | 0 (Fault injected) | **0** | **CLEAN** |
| `product_variants` | 0 (Worker skipped) | **0** | **CLEAN** |
| `inventory_balances` | 0 (Worker skipped) | **0** | **CLEAN** |
| `inventory_ledgers` | 0 (Worker skipped) | **0** | **CLEAN** |
| `payment_transactions` | 0 (Worker skipped) | **0** | **CLEAN** |
| `legacy_stock_movements` | 0 (Worker skipped) | **0** | **CLEAN** |
| `users` (mutated rows) | 0 (Worker skipped) | **0** | **CLEAN** |

### 4.3 Fail-Closed Test Results
```text
===============================================================
PROMPT 13.3C-CORRECTION — FAILURE-INJECTION & ACID TRANSACTION TEST
===============================================================
--- TEST 0: STATIC SECURITY REDACTION SCAN (NO PLAINTEXT PIN EXPOSURE) ---
✅ [PASS] Security Scan: Zero Plaintext PINs or Direct PIN Logging in New Artifacts: 0 violations detected across 19 artifacts.

--- TEST 1: BASELINE DISPOSABLE DB STATE CHECK ---
✅ [PASS] Baseline Table "storage_locations" Empty: Expected 0 rows in "storage_locations", found 0
...
--- TEST 2: INTENTIONAL FAILURE INJECTION & TRANSACTION ROLLBACK ---
[INFO] Starting Well POS Backfill Orchestrator (DryRun: false)
[INFO] Beginning ACID transaction for tenant batch: 1b29b1a6-898b-4aab-bbda-76db544c4a8f
[INFO] Finished 02_storage_locations: Created=2, Skipped=0, Errors=0
[INFO] Starting Worker: 03_inventory_items (DryRun: false)
[ERROR] Fatal error during backfill orchestration (aborted & rolled back) Error: FAILURE_INJECTION_TRIGGERED: Injected fatal mutation error in worker 03_inventory_items
Caught expected live mutation failure: FAILURE_INJECTION_TRIGGERED: Injected fatal mutation error in worker 03_inventory_items
✅ [PASS] Orchestrator Fails Closed on Mutation Error: Orchestrator threw expected failure-injection error
✅ [PASS] Post-Rollback Table "storage_locations" has 0 rows: Expected 0 rows in "storage_locations" after rollback, found 0
✅ [PASS] Post-Rollback Users Completely Unmutated: Expected 0 mutated users after rollback, found 0
```

---

## 5. OD-13.3-03 REDACTED PIN & CREDENTIAL RECONCILIATION CONTRACT

### 5.1 Physical Baseline Audit Findings (Non-Secret Classification)
A direct read-only query on `pos_db` established the exact user baseline without exposing secrets:

| User ID | Name | Role | PIN Status Classification | Legacy `user_code` | Legacy `pin_hash` | Target Expectation |
|---|---|---|---|---|---|---|
| `e2dce666-fe56-4b47-a39f-9ca911528fef` | Rudra | ADMIN | `LEGACY_PIN_PRESENT` | `NULL` | `NULL` | `hash generated = yes`, `bcrypt format valid = yes` |
| `84f253ff-9f3f-4273-9ed5-621ace395198` | Dian Anjani (Kasir 1) | CASHIER | `LEGACY_PIN_PRESENT` | `NULL` | `NULL` | `hash generated = yes`, `bcrypt format valid = yes` |

- **Actual PIN-less Users in Baseline (`LEGACY_PIN_NULL`):** **0**. Both users hold legacy credentials classified as `LEGACY_PIN_PRESENT`.
- Report 18 erratum corrected: Rudra is classified as `LEGACY_PIN_PRESENT`; both baseline users require Bcrypt hashing of their existing legacy PIN without exposing plaintext values.

### 5.2 OD-13.3-03 Invariant Specification
1. **For Any PIN-less User (`LEGACY_PIN_NULL`):**
   - Must be allocated a collision-safe deterministic `user_code`.
   - `pin_hash` MUST REMAIN `NULL` (`pin_hash remains NULL = yes`). Zero synthetic default PINs or synthetic hashes may be generated.
   - An operational warning notice must be emitted indicating terminal login requires subsequent provisioning.
2. **For Legacy PIN Holders (`LEGACY_PIN_PRESENT`):**
   - Must be allocated a collision-safe deterministic `user_code`.
   - `pin_hash` must contain a valid Bcrypt hash (`$2a$` or `$2b$`) derived from the legacy PIN (`hash generated = yes`, `bcrypt format valid = yes`).
3. **Post-Backfill Reconciliation Rule (`reconcile_user_credentials.ts`):**
   - Suite `IAM: Active Users Model B Credential Coverage`: Reconciles that 100% of active users have `user_code`, and all legacy PIN holders have `bcrypt format valid = yes`.
   - Suite `IAM: OD-13.3-03 Invariant`: Strictly asserts that users with `LEGACY_PIN_NULL` have `pin_hash remains NULL = yes`. If any PIN-less user receives a non-null `pin_hash`, the suite fails.

### 5.3 Disposable DB Test with Synthetic PIN-less User
To validate OD-13.3-03 compliance, a test user with `pin = NULL` (`test_pinless_user`) was provisioned in the disposable database:
- `test_pinless_user` received `user_code = 'USR-TESTPI'` and `pin_hash = NULL` (`pin_hash remains NULL = yes`).
- Existing users (`e2dce666...` and `84f253ff...`) received Bcrypt hashes (`hash generated = yes`, `bcrypt format valid = yes`).
- All 3 IAM credential reconciliation suites passed with 0 discrepancies:
  - `✅ [PASS] OD-13.3-03: PIN-less User Allocated Valid user_code: User code: USR-TESTPI`
  - `✅ [PASS] OD-13.3-03: PIN-less User Retains pin_hash = NULL: pin_hash remains NULL = yes`
  - `✅ [PASS] Legacy PIN Users Receive Valid Bcrypt Hashes: hash generated = yes, bcrypt format valid = yes`
  - `✅ [PASS] Reconciliation: IAM: Active Users Model B Credential Coverage (0 Discrepancies)`
  - `✅ [PASS] Reconciliation: IAM: UserCode Uniqueness per Tenant (0 Discrepancies)`
  - `✅ [PASS] Reconciliation: IAM: OD-13.3-03 Invariant (0 Discrepancies)`

---

## 6. SANITIZED OWNER AUTHORIZATION PACKAGE FOR LIVE BACKFILL

> [!CAUTION]
> **OPERATIONAL GUARD:** The instructions in this section are prepared for Owner authorization review. **DO NOT EXECUTE** without a separate, explicit Owner Decision authorization prompt.

### 6.1 Exact Proposed Live Backfill Command
All commands utilize environment variables. No credentials are hardcoded.

```bash
# Set environment variables in operational session (replace with production secrets securely)
export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public"

# Execute Live Backfill from pos_apps/server directory
cd /path/to/pos_apps/server
npx tsx src/migrations/backfill/index.ts --execute
```

### 6.2 Pre-Execution Checklist
Before executing the live Backfill command, verify every item:
- [ ] Application server is verified **OFFLINE** (0 active client connections to `pos_db`).
- [ ] Database active connection audit shows only the migration runner:
  ```sql
  SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();
  ```
- [ ] Fresh pre-backfill physical backup has been created and verified via restore test in an isolated sandbox (see Section 6.3).
- [ ] Read-only pre-execution count confirms target tables are completely empty (0 rows).
- [ ] Owner has formally signed off on the authorization package.

### 6.3 Required Backup & Verification Procedure
Prior to live execution, a full binary dump must be taken and verified against an isolated sandbox database:

```bash
# 1. Create timestamped physical backup
mkdir -p server/backups
PGPASSWORD="${PGPASSWORD}" pg_dump -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" -F c -b -v \
  -f "server/backups/pos_db_pre_backfill_$(date +%Y%m%d_%H%M%S).dump" "${PGDATABASE}"

# 2. Verify backup file size and non-empty status
ls -lh server/backups/pos_db_pre_backfill_*.dump

# 3. Test restore into a temporary, isolated sandbox database (never pos_db)
PGPASSWORD="${PGPASSWORD}" dropdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" --if-exists pos_restore_sandbox
PGPASSWORD="${PGPASSWORD}" createdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" pos_restore_sandbox
PGPASSWORD="${PGPASSWORD}" pg_restore -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" -d pos_restore_sandbox -v \
  "$(ls -t server/backups/pos_db_pre_backfill_*.dump | head -n 1)"

# 4. Clean up test database
PGPASSWORD="${PGPASSWORD}" dropdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" pos_restore_sandbox
```

### 6.4 Transaction & Recovery Strategy
1. **Per-Tenant ACID Transaction:**
   - Every tenant batch executes inside `prisma.$transaction`.
   - If any worker encounters an unhandled exception or SQL constraint violation, the orchestrator fails closed, aborts the active transaction, and halts further execution.
2. **Deterministic Idempotency:**
   - Target table inserts use `ON CONFLICT ("id") DO NOTHING` with deterministic UUIDv5 primary keys.
3. **Owner-Authorized Recovery Procedure:**
   - If a fatal, irrecoverable failure occurs during live execution that cannot be addressed within the migration framework, no automated destructive drop commands are run.
   - Any restore operation over `pos_db` must be executed under a **separate, explicit Owner Maintenance Authorization**, following standard disaster recovery runbooks with dual-operator verification.

### 6.5 Expected Mutation Inventory (Deterministic Baseline)

| Worker | Target Table / Operation | Expected Mutated Rows | Deterministic Identifiers / Rules |
|---|---|---|---|
| `01_tenant_audit` | Audit scan | 0 | 0 NULL tenant_ids; 7 clean legacy tables |
| `02_storage_locations` | `INSERT storage_locations` | 2 | `4e56cb83-f465-5f1d-a75b-60853ac8a477`<br>`ea88e187-6fbe-5494-9d02-6b157be45c97` |
| `03_inventory_items` | `INSERT inventory_items` | 1 | `e6e38e3f-1f05-597e-aabf-75cbfcc074c9` (`sku=CM7K01-INV`) |
| `04_product_variants` | `INSERT product_variants` | 1 | `ef5a35c5-6512-52e1-99f1-539c9b3c71b4` (`name=Default`, mult=1.000) |
| `05_inventory_balances` | `INSERT inventory_balances` | 2 | `e71c7c9b-d544-5048-9aef-6bcf8062b0f7`<br>`a1962028-a148-5a9c-b221-96f6dfb3e37e` |
| `06_inventory_ledger_baseline` | `INSERT inventory_ledgers` | 2 | `d05fd2e6-4405-5f37-8ad0-317a4d0688d3`<br>`0a6d1787-ca2d-571e-bdb5-dea0c6f734a3` |
| `07_user_model_b` | `UPDATE users` | 2 | `e2dce666...` -> `user_code=USR-E2DCE6`, `hash generated = yes`, `bcrypt format valid = yes`<br>`84f253ff...` -> `user_code=USR-KASIR1`, `hash generated = yes`, `bcrypt format valid = yes`<br>*(Any user with `LEGACY_PIN_NULL` strictly receives `pin_hash remains NULL = yes`)* |
| `08_order_items` | `UPDATE order_items` | 0 | 0 legacy order items present in current baseline |
| `09_payment_transactions` | `INSERT payment_transactions` | 0 | 0 legacy payments present in current baseline |
| `10_archive_stock_movements` | `INSERT legacy_stock_movements` | 2 | `6265874b-558f-462a-adae-e8fb6e2cff20`<br>`5479faef-613c-40f0-bc62-7a33d35dd480` |
| **Total Expected Mutations** | — | **12** | **10 Target Inserts + 2 Legacy User Updates** |

### 6.6 Strict Stop Conditions
The live Backfill execution must be immediately stopped and flagged if any of the following occur:
1. Pre-execution audit reveals `storage_locations` or any target table count `> 0`.
2. Any worker throws a foreign key, check constraint, unique violation, or fatal script error.
3. Total target rows created deviates from expected count (10 target rows).
4. Any active application connection connects to `pos_db` during execution.

### 6.7 Post-Execution Reconciliation Commands
Immediately following live execution, the unified reconciliation parity test suite must be triggered:

```bash
# Execute full post-backfill reconciliation parity suite
DATABASE_URL="${DATABASE_URL}" npx tsx src/migrations/reconciliation/reconcile_all.ts
```

**Corrected Post-Backfill Parity Expectations:**
- Tenant Boundary Integrity: **0 discrepancies**
- Catalog & Variant Coverage: **0 discrepancies** (all products mapped 1:1 to variants)
- Inventory Physical Baseline: **0 discrepancies** (all balances equal outlet_products stock)
- Ledger Audit Equality: **0 discrepancies** (all balances equal opening ledger delta)
- User Model B Credentials: **0 discrepancies** (all active users have `user_code`, legacy PIN holders have `bcrypt format valid = yes`, PIN-less users retain `pin_hash remains NULL = yes`)
- Sales & Payment Parity: **0 discrepancies**
- **Corrected Lifecycle Verdict:** `100% PARITY ACHIEVED — READY FOR POST-BACKFILL RECONCILIATION REVIEW & DUAL-WRITE AUTHORIZATION PLANNING`

---

## 7. READ-ONLY PRODUCTION DATABASE (`pos_db`) SAFETY AUDIT

A direct, read-only SQL audit against `pos_db` verified the following metrics:

1. **Target Table Row Counts:**
   - `storage_locations`: 0 rows
   - `inventory_items`: 0 rows
   - `product_variants`: 0 rows
   - `inventory_balances`: 0 rows
   - `inventory_ledgers`: 0 rows
   - `payment_transactions`: 0 rows
   - `legacy_stock_movements`: 0 rows
   - **Total Target Rows:** **0 (Zero Mutations)**
2. **Protected Legacy Tables Row Counts:**
   - Exactly **17 rows** across all 18 protected legacy tables (`categories`: 1, `outlet_products`: 2, `outlets`: 2, `platform_users`: 1, `products`: 1, `stock_movements`: 2, `subscription_plans`: 4, `tenant_subscriptions`: 1, `tenants`: 1, `users`: 2; other 8 tables: 0).
3. **Application Server Quiescence:**
   - Operating system process check (`ps aux | grep -iE 'node|nest|pos'`) confirmed **0 active application server instances**.
   - Application remains strictly offline and quiescent.
4. **Prisma Client State:**
   - Directory `node_modules/@prisma/client` timestamp: `Sep 15 13:20` (unmodified).
   - `prisma generate` command: **NOT EXECUTED**.

---

## 8. FINAL GATE DECLARATION

```text
===================================================================================
FINAL GATE: READY FOR OWNER AUTHORIZATION — LIVE BACKFILL NOT YET EXECUTED
===================================================================================
```

**Formal Status Statement:**
- Plaintext PIN values have been completely redacted from all documentation, test outputs, and migration artifacts.
- Automated static security scan confirms 0 plaintext PIN literals, 0 PIN interpolations, and 0 direct PIN logging across all 19 artifacts.
- Source code remediation is complete: ACID transaction boundary per tenant batch implemented; live mutation errors fail closed and roll back.
- Intentional failure injection on isolated disposable database proved that 0 partial rows persist after an aborted transaction.
- OD-13.3-03 compliance is proven: PIN-less users retain `pin_hash = NULL`, and legacy PINs are Bcrypt hashed.
- The authorization package is fully sanitized: zero plaintext credentials, zero in-place destructive drop instructions, and corrected lifecycle transition wording.
- Production database `pos_db` is confirmed completely unmutated, application remains offline/quiescent, and Prisma client remains unregenerated.
- **NO LIVE BACKFILL HAS OCCURRED.** Live execution is strictly halted pending Owner review and explicit authorization.
