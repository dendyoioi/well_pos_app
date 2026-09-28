# COMMAND — PROMPT 13.1A → OWNER DECISION → PROMPT 13.1B

Antigravity,

Execute the next migration-safety stage using the two canonical prompts:

1. `PROMPT_13_1A_ORDER_ITEMS_PRECISION_AND_RECOVERY_BLOCKER_ANALYSIS_OWNER_DECISION.md`
2. `PROMPT_13_1B_AUTHORIZED_BLOCKER_RESOLUTION_BACKUP_AND_REPREFLIGHT.md`

## STAGED WORKFLOW

### STAGE A — ANALYZE

Execute Prompt 13.1A only.

Workflow:

READ → UNDERSTAND → VERIFY → ANALYZE OPTIONS → PREPARE OWNER DECISION → STOP

Do not mutate `pos_db`.
Do not create backup.
Do not alter migration.sql.
Do not run Expand.

Return the Owner Decision Packet and STOP.

---

### OWNER DECISION GATE

The following two decisions must be explicitly authorized before Stage B:

1. Treatment for:
   - `order_items.cost_price`
   - `order_items.discount_amount`

2. Physical backup / recovery requirement.

No implied authorization.

No assumption.

---

### STAGE B — RESOLUTION

Only after explicit Owner authorization, execute Prompt 13.1B.

Workflow:

READ OWNER DECISION
→ VERIFY LIVE STATE
→ BACKUP / VERIFY
→ EXECUTE ONLY AUTHORIZED RESOLUTION
→ VALIDATE
→ RE-RUN PROMPT 13.1
→ REPORT
→ FINAL GATE
→ STOP

## SAFETY RULE

If the selected `order_items` treatment requires any live database mutation, a verified physical backup MUST exist before the first mutation.

The safety requirement overrides any nominal ordering that would otherwise place backup after live mutation.

## HARD PROHIBITIONS

At all times:

- No Expand migration
- No `prisma migrate deploy`
- No Prompt 13.2
- No Backfill
- No Dual-write
- No Cutover
- No Contract
- No destructive reset
- No unrelated database change

## FINAL GATE

The only permitted outcomes after Stage B are:

`READY FOR EXPAND EXECUTION`

or

`BLOCKED / OWNER REVIEW REQUIRED`

Even if READY:

STOP.

Do not execute Expand.

## EVIDENCE RULE

Use actual evidence only.

Never convert:
- expected → observed;
- intended → executed;
- available in theory → verified.

FAIL-CLOSED whenever evidence is insufficient.
