# OWNER DECISION — PROMPT 13.2A ENUM TRANSITION / PROVENANCE BLOCKER

## Context

The authorized Expand execution `OAUTH-13.2-01` aborted safely at Section 0.2 because `PlatformRole` already exists in `pos_db` but had no ownership record in `_prompt_12_ownership_registry`.

The failure is safe and the database is verified unchanged. The important distinction is that only 3 live enums are exact-compatible with the target contract; 7 are not.

## Current verified state

Exact-compatible:

- `BillingCycle`
- `ShiftStatus`
- `TenantStatus`

Incompatible:

- `PlatformRole`
- `InvoiceStatus`
- `Role`
- `StockMovementType`
- `PaymentStatus`
- `PaymentMethod`
- `PaymentTxStatus`

## Decision required

The Project Owner must review the Prompt 13.2A read-only analysis before approving any next mutation.

### Decision A — First-run provenance handling

Choose one after reviewing evidence:

- **A1:** Authorize a controlled provenance bootstrap for exact-compatible pre-existing enums only, with exact catalog comparison first and `PRESERVE` rollback semantics.
- **A2:** Do not allow any provenance bootstrap; require all provenance to come from a separately established pre-migration registry process.

### Decision B — Incompatible enum strategy

Choose one after reviewing evidence:

- **B1:** Authorize a separate enum vocabulary transition stage before Expand.
- **B2:** Authorize a prototype database reset/rebuild strategy, only if the existing Owner Decisions and data-retention requirements explicitly permit it.
- **B3:** Require another architecture strategy to be analyzed before any mutation.

### Decision C — Expand sequencing

- **C1:** Keep Expand as a single frozen migration artifact and solve enum prerequisites before retry.
- **C2:** Allow a separately authorized split/sequence only after a new migration design and rollback proof are reviewed.

## Explicit boundary

This document itself authorizes **no database mutation**.

The existing `OAUTH-13.2-01` authorization does not authorize a new enum transition or a modified migration artifact.

No retry of Expand is authorized by this document alone.
