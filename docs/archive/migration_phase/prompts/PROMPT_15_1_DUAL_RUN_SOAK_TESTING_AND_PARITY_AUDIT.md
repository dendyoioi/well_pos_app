# PROMPT 15.1 — DUAL-RUN SOAK TESTING, CONCURRENCY & CONTINUOUS PARITY AUDIT

## 0. CONTEXT & LIFECYCLE POSITION

**Migration Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED (100% Schema Ready — Prompt 13.2)
  [ BACKFILL ]   ===>  COMPLETED (100% Historical Parity — Prompt 13.4)
  [ DUAL-WRITE ] ===>  COMPLETED (100% Live Parity Verified — OAUTH-14.4-01)
  [ FASE 15 ]    ===>  STAGE 15.1: DUAL-RUN SOAK TESTING & PARITY AUDIT
  [ CUTOVER ]    ===>  PENDING (Target Phase 16)
  [ CONTRACT ]   ===>  PENDING (Target Phase 17)
```

Following the formal closure of Phase 14 (OAUTH-14.4-01), the dual-write domain services are operational on `pos_db`.
Stage 15.1 focuses on **dual-run stabilization**: subjecting the dual-write engine to high-concurrency race conditions, complex multi-domain mutations, sustained throughput, and continuous reconciliation auditing.

---

## 1. OBJECTIVES

Antigravity (*Implementation Agent*) is mandated to execute Stage 15.1 with the following objectives:
1. **Parallel Concurrency & Row Locking Test:**
   - Execute parallel cashier checkout requests competing for limited stock of the same item.
   - Verify that row-level locking (`SELECT ... FOR UPDATE` on `inventory_balances`) prevents race conditions, overselling, or negative stock violations when strict policy applies (ADR-002).
2. **Multi-Domain Dual-Run Transaction Workload:**
   - Multi-item retail checkout with split payment (Cash + QRIS).
   - Packaging multiplier consumption (ADR-003).
   - Inbound stock receipt & outbound disposal/damage.
   - Inter-outlet stock transfer (`transferStock`) across branches.
   - Stock opname adjustment.
3. **Continuous Parity & Drift Verification:**
   - Run the 14-suite reconciliation test suite (`reconcile_all.ts`) before, during, and after the soak run.
   - Prove 100.00% parity (zero variance) across all dimensional suites.
4. **Latency Overhead Assessment:**
   - Measure transaction execution durations to quantify the dual-write processing overhead.

---

## 2. HARD SAFETY BOUNDARIES

During Stage 15.1:
- **STRICTLY PROHIBITED:**
  - Any DDL statement (`DROP`, `TRUNCATE`, `ALTER`).
  - Any deactivation or disabling of dual-write routines.
  - Overwriting `@prisma/client` (`npx prisma generate` is forbidden).
  - Destructive manipulation of existing historical backfill data.
- **MANDATED:**
  - Use dedicated, traceable test data identifiers (`SOAK-TEST-*`).
  - Isolate test execution within the active database connection pool without leaking connections.
  - Full audit logging of all executed mutations and parity results.

---

## 3. DELIVERABLES REQUIRED

1. **Soak & Concurrency Test Engine:**  
   `pos_apps/server/src/migrations/dual_write/soak_concurrency_dual_run.ts`
2. **Formal Validation & Telemetry Report:**  
   `docs/validation/24_PROMPT_15_1_DUAL_RUN_STABILIZATION_REPORT.md`

### Final Gate Declaration:
```text
FINAL GATE: STAGE 15.1 SOAK TEST COMPLETED — READY FOR STAGE 15.2 READ SURFACE AUDIT
```
