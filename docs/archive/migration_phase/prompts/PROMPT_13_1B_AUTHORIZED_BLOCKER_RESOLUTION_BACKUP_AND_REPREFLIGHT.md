# PROMPT 13.1B — AUTHORIZED BLOCKER RESOLUTION, BACKUP VERIFICATION & PREFLIGHT RE-RUN

## DOCUMENT CONTROL

**Stage:** Prompt 13.1B — Authorized Blocker Resolution & Re-Preflight  
**Parent Stage:** Prompt 13.1A + Prompt 13.1  
**Mode:** CONTROLLED RESOLUTION + VALIDATION  
**Migration Execution:** PROHIBITED unless separately authorized  
**Expand Execution:** PROHIBITED  
**Prompt 13.2:** PROHIBITED  
**Backfill:** PROHIBITED  
**Dual-write:** PROHIBITED  
**Cutover:** PROHIBITED  
**Contract:** PROHIBITED

---

# 1. ROLE

You are **Antigravity**, acting as:

**Lead Database & Systems Architect + Migration Safety Lead**

You may execute ONLY the resolution explicitly authorized by the Owner after Prompt 13.1A.

---

# 2. REQUIRED PRECONDITION

Do not begin until an explicit Owner Decision exists for:

1. `order_items` precision treatment;
2. physical backup creation/verification.

The Owner Decision must identify exactly what is authorized.

If the Owner Decision is missing, ambiguous, or broader than the proposed scope:

**STOP — BLOCKED / OWNER REVIEW REQUIRED**

---

# 3. SOURCE-OF-TRUTH HIERARCHY

Use:

1. Explicit Owner Decision from Prompt 13.1A
2. Actual `pos_db`
3. Executable migration.sql
4. rollback.sql
5. Target Schema Revision 4
6. Prisma schema
7. Application contract
8. Prompt 13.1A evidence
9. Prompt 13.1 evidence
10. Execution Guardrails

Do not exceed the Owner-approved scope.

---

# 4. EXECUTION PROTOCOL

Follow exactly:

```text
READ OWNER DECISION
  ↓
VERIFY CURRENT LIVE STATE
  ↓
VERIFY AUTHORIZATION SCOPE
  ↓
CREATE / VERIFY REQUIRED BACKUP
  ↓
VERIFY BACKUP INTEGRITY
  ↓
EXECUTE ONLY AUTHORIZED RESOLUTION
  ↓
VALIDATE RESOLUTION
  ↓
RE-RUN PROMPT 13.1 PREFLIGHT
  ↓
REPORT
  ↓
GATE
  ↓
STOP
```

### Safety override

If the authorized treatment requires any mutation of real `pos_db`, a verified backup MUST exist and MUST be integrity-checked **before the first mutation**.

Never mutate first and back up later.

---

# 5. PHASE 1 — READ OWNER DECISION

Read the final Owner Decision artifact:

`/docs/validation/14_PROMPT_13_1A_BLOCKER_ANALYSIS_OWNER_DECISION.md`

Extract explicitly:

- selected `order_items` treatment;
- selected implementation scope;
- selected backup requirement;
- any restrictions;
- any rollback requirements.

Create an execution authorization checklist.

---

# 6. PHASE 2 — VERIFY LIVE PRE-RESOLUTION STATE

Before any mutation, re-query:

- `order_items.cost_price`;
- `order_items.discount_amount`;
- row count of `order_items`;
- target tables;
- transition columns;
- live enum state;
- migration registry/history;
- total row count;
- database identity.

The observed state must match Prompt 13.1 unless a documented intervening change exists.

If it does not match:

**STOP — BLOCKED / OWNER REVIEW REQUIRED**

---

# 7. PHASE 3 — BACKUP

Execute the explicitly authorized backup procedure.

For a physical PostgreSQL backup, at minimum:

```bash
pg_dump -Fc -h localhost -U postgres -d pos_db -f <approved_backup_path>
```

Do not hard-code a secret into documentation.

Do not expose database passwords in reports.

Verify:

- command exit code = 0;
- backup file exists;
- file size is non-zero and plausible;
- backup archive can be inspected using a non-mutating verification command;
- database identity in the backup metadata matches `pos_db`;
- timestamp is recorded;
- checksum/hash may be recorded if the project requires it.

Where supported, use a non-mutating integrity/listing check such as:

```bash
pg_restore --list <approved_backup_path>
```

Do not restore over real `pos_db`.

If backup creation or integrity verification fails:

**STOP — BLOCKED / OWNER REVIEW REQUIRED**

Do not proceed to live schema mutation.

---

# 8. PHASE 4 — EXECUTE ONLY THE AUTHORIZED `order_items` RESOLUTION

Use the Owner-selected option exactly.

## If the Owner authorized migration preflight correction

Only modify the specified migration artifact.

Verify:

- exact lines changed;
- no unrelated behavior changed;
- expected target contract remains documented;
- test implications are understood.

Do not weaken safety validation merely to obtain PASS.

## If the Owner authorized live column alignment

Only modify the specified columns.

Before execution verify:

- backup is already verified;
- column row count;
- current values;
- target precision/scale;
- conversion is lossless;
- transaction behavior;
- rollback/recovery implication.

Execute only the minimum authorized DDL.

Do not alter unrelated columns.

Do not change data values.

## If another Owner-authorized treatment was selected

Execute only the exact authorized treatment.

Any deviation requires a new Owner Decision.

---

# 9. PHASE 5 — POST-RESOLUTION VALIDATION

Immediately verify:

## `order_items`

- actual type;
- precision;
- scale;
- nullability;
- default;
- row count;
- existing values.

## Migration artifacts

If migration.sql was changed:

- inspect diff;
- run syntax/static validation;
- re-check target contract consistency.

## Database integrity

Re-check:

- 18 legacy tables;
- 17 rows or actual new baseline if an authorized mutation legitimately changes structure/data;
- zero unexpected target tables unless the authorized treatment explicitly creates one;
- zero unexpected indexes/FKs;
- enum state;
- ownership registry.

Document any intentional change.

---

# 10. PHASE 6 — RE-RUN PROMPT 13.1 PREFLIGHT

Run the complete Prompt 13.1 preflight again.

Do not run Expand.

Expected outcome:

The previous blockers must either:

### A. Be resolved

or

### B. Remain blocked with a new precise reason.

Do not mark READY simply because the original error disappeared.

All other 13.1 prerequisites must still be re-evaluated.

---

# 11. PHASE 7 — RECONCILIATION

Compare:

```text
Prompt 13.1 BEFORE
        ↓
Authorized Resolution
        ↓
Current State
        ↓
Prompt 13.1 RE-RUN
```

Produce a before/after matrix:

| Check | Before | Resolution | After | Status |
|---|---|---|---|---|
| `cost_price` precision | ... | ... | ... | ... |
| `discount_amount` precision | ... | ... | ... | ... |
| Physical backup | NOT VERIFIED | backup | VERIFIED | ... |
| Target collisions | ... | ... | ... | ... |
| Live enums | ... | unchanged | ... | ... |
| Locks | ... | ... | ... | ... |
| Migration history | ... | ... | ... | ... |

---

# 12. REQUIRED ARTIFACTS

Create/update:

`/docs/validation/14_PROMPT_13_1B_BLOCKER_RESOLUTION_EVIDENCE.md`

`/docs/validation/14_PROMPT_13_1B_FINAL_REPORT.md`

If the project has a canonical Prompt 13.1 final report artifact, update it only after re-running the full preflight and reconciling the result.

---

# 13. DATABASE SAFETY ATTESTATION

Report actual facts:

- whether any live DDL occurred;
- whether any live DML occurred;
- exact statements executed;
- backup path and verification evidence;
- before/after schema state;
- whether data values changed;
- whether target tables exist;
- whether migration was executed;
- whether Prompt 13.2 was executed.

Never claim zero mutation if the authorized resolution included a live ALTER.

If a live schema mutation occurred, state it explicitly.

---

# 14. FINAL GATE

Apply Prompt 13.1 rules again.

## READY FOR EXPAND EXECUTION

Only if:

- all critical blockers are resolved;
- backup/recovery evidence is sufficient;
- current runtime/database state passes preflight;
- no unexplained drift exists;
- no new blocker exists.

This means **readiness only**.

It does NOT authorize Expand.

## BLOCKED / OWNER REVIEW REQUIRED

If any critical blocker remains or evidence is insufficient.

---

# 15. STOP CONDITION

Regardless of result:

**STOP.**

Do NOT:

- execute Expand;
- execute Prisma deploy;
- execute Prompt 13.2;
- Backfill;
- Dual-write;
- Cutover;
- Contract.

---

# 16. FINAL RESPONSE FORMAT

Return exactly:

## 1. Owner Authorization Verified
## 2. Pre-Resolution State
## 3. Backup Creation & Verification
## 4. Exact Authorized Resolution Executed
## 5. Post-Resolution Validation
## 6. Prompt 13.1 Re-Run Results
## 7. Before / After Reconciliation
## 8. Database Safety Attestation
## 9. Remaining Risks / Blockers
## 10. Final Gate
## 11. Explicit Confirmation: Expand / Prompt 13.2 NOT Executed
