# Prompt 12.5-C: Enum Evidence Provenance & Correction Register

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strict Documentation Provenance Audit / Zero Database Mutation  
**Execution Stage:** Prompt 12.5-C — Evidence Provenance Register  
**Date:** 2026-09-20  

---

## 1. Purpose

This register formally documents every previous erroneous, stale, or contradictory statement identified across intermediate Prompt 12.5 artifacts, traces its erroneous source, cites the ground-truth live catalog and canonical architectural specifications, and records the authoritative corrected statement.

No silent corrections are permitted.

---

## 2. Evidence Provenance & Correction Entries

### Entry EPC-01: `TenantStatus` Legacy Enum Vocabulary (`INACTIVE` vs `CANCELLED`)

- **Previous Statement:**  
  *"Legacy TenantStatus contains `ACTIVE, SUSPENDED, INACTIVE, TRIAL, PENDING` (5 labels). `INACTIVE` is present in legacy and absent from Target Revision 4; `CANCELLED` is additive in Target Revision 4."*
- **Source Artifact:**  
  `PROMPT_12_5_ENUM_VOCABULARY_MIGRATION_STRATEGY_DATA_DEPENDENCY_REVIEW.md:71` and `11_PROMPT_12_5_ENUM_VOCABULARY_ANALYSIS.md:23, 50`.
- **Live Evidence (`pos_db`):**  
  ```sql
  SELECT enumlabel, enumsortorder 
  FROM pg_enum 
  WHERE enumtypid = 'public."TenantStatus"'::regtype 
  ORDER BY enumsortorder;
  ```
  Output:
  - `TRIAL` (sort order 1)
  - `ACTIVE` (sort order 2)
  - `SUSPENDED` (sort order 3)
  - `CANCELLED` (sort order 4)
  - `PENDING` (sort order 5)
- **Canonical Architecture Source:**  
  `04_TARGET_DATABASE_SCHEMA.md:859` defines `enum TenantStatus { TRIAL, ACTIVE, SUSPENDED, CANCELLED }`.  
  `10_PROMPT_12_4_2_ENUM_CONTRACT_INVENTORY.md:16` previously documented `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`.
- **Corrected Statement:**  
  `TenantStatus` in the real `pos_db` catalog contains exactly 5 labels: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING`. `INACTIVE` does **not** exist in `pos_db`, does not exist in `schema.prisma`, and does not exist in application code. Target Revision 4 labels `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']` are 100% **EXACT MATCHES** with the live catalog. The only legacy divergence is `PENDING`.
- **Reason for Correction:**  
  Intermediate analysis in Prompt 12.5 uncritically echoed a hypothesis from the prompt narrative that assumed `INACTIVE` existed. Direct PostgreSQL catalog queries prove `INACTIVE` was never created, and `CANCELLED` was already present in `pos_db`.

---

### Entry EPC-02: Target Invoice Enum Identity (`SubscriptionInvoiceStatus` vs `InvoiceStatus`)

- **Previous Statement:**  
  *"Target Revision 4 defines `SubscriptionInvoiceStatus (DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE)`."*
- **Source Artifact:**  
  `11_PROMPT_12_5_ENUM_DATA_DISTRIBUTION.md:103` and intermediate Prompt 12.5 notes.
- **Live Evidence (`pos_db`):**  
  ```sql
  SELECT enumlabel, enumsortorder 
  FROM pg_enum 
  WHERE enumtypid = 'public."InvoiceStatus"'::regtype 
  ORDER BY enumsortorder;
  ```
  Output: `UNPAID` (1), `PAID` (2), `CANCELLED` (3), `EXPIRED` (4).
- **Canonical Architecture Source:**  
  `04_TARGET_DATABASE_SCHEMA.md:878` explicitly defines:
  ```prisma
  enum InvoiceStatus {
    DRAFT
    UNPAID
    PAID
    VOID
  }
  ```
  `server/prisma/schema.prisma:774` also defines `enum InvoiceStatus { DRAFT, UNPAID, PAID, VOID }`.
- **Corrected Statement:**  
  The target enum is named `InvoiceStatus` with canonical labels `DRAFT`, `UNPAID`, `PAID`, `VOID`. The type name `SubscriptionInvoiceStatus` and labels `OPEN`, `UNCOLLECTIBLE` do not exist in Target Database Schema Revision 4 or in the Prisma schema.
- **Reason for Correction:**  
  `SubscriptionInvoiceStatus` was an inadvertent external terminology intrusion (Stripe SaaS billing model) introduced during Prompt 12.5 data distribution drafting. Canonical Target Revision 4 has always used `InvoiceStatus`.

---

### Entry EPC-03: `Role` Legacy Enum Catalog Composition (`SUPERVISOR` Omission)

- **Previous Statement:**  
  *"Legacy Role in pos_db contains only `ADMIN, CASHIER, WAREHOUSE` (3 labels)."*
- **Source Artifact:**  
  `11_PROMPT_12_5_ENUM_VOCABULARY_ANALYSIS.md:25` and early audit notes.
- **Live Evidence (`pos_db`):**  
  ```sql
  SELECT enumlabel, enumsortorder 
  FROM pg_enum 
  WHERE enumtypid = 'public."Role"'::regtype 
  ORDER BY enumsortorder;
  ```
  Output:
  - `ADMIN` (sort order 1)
  - `SUPERVISOR` (sort order 2)
  - `WAREHOUSE` (sort order 3)
  - `CASHIER` (sort order 4)
- **Canonical Architecture Source:**  
  `04_TARGET_DATABASE_SCHEMA.md:891` defines `enum Role { OWNER, ADMIN, SUPERVISOR, CASHIER, KITCHEN, WAITER }`.
- **Corrected Statement:**  
  `Role` in `pos_db` catalog contains 4 labels: `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`. Consequently, `SUPERVISOR` is pre-existing in `pos_db` and represents an **EXACT MATCH** with Target Revision 4. The sole unmapped label is `WAREHOUSE`.
- **Reason for Correction:**  
  Earlier documentation overlooked `SUPERVISOR` in the legacy catalog because `users.role` only holds `ADMIN` and `CASHIER` rows in data, and `schema.prisma` historical legacy lines had simplified the enum. Live `pg_enum` confirms `SUPERVISOR` is present at sort order 2.

---

### Entry EPC-04: `PaymentStatus` Legacy Catalog Baseline (`UNPAID` Label)

- **Previous Statement:**  
  *"Legacy PaymentStatus catalog in pos_db contains `PAID, UNPAID, CANCELLED, REFUNDED` (4 labels)."*
- **Source Artifact:**  
  `11_PROMPT_12_5_ENUM_VOCABULARY_ANALYSIS.md:27`.
- **Live Evidence (`pos_db`):**  
  ```sql
  SELECT enumlabel, enumsortorder 
  FROM pg_enum 
  WHERE enumtypid = 'public."PaymentStatus"'::regtype 
  ORDER BY enumsortorder;
  ```
  Output:
  - `PAID` (sort order 1)
  - `CANCELLED` (sort order 2)
  - `REFUNDED` (sort order 3)
- **Canonical Architecture Source:**  
  `04_TARGET_DATABASE_SCHEMA.md:970` defines `enum PaymentStatus { UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED }`.
- **Corrected Statement:**  
  `PaymentStatus` in `pos_db` catalog contains exactly 3 labels: `PAID`, `CANCELLED`, `REFUNDED`. The label `UNPAID` does not exist in the legacy `PaymentStatus` enum in `pos_db` (orders defaulted to `PAID`). `UNPAID` is introduced as a target additive label in Target Revision 4.
- **Reason for Correction:**  
  Prisma schema comments had casually referenced `UNPAID`, but PostgreSQL catalog `pg_enum` inspection confirms only 3 labels were ever registered in `pos_db`.

---

### Entry EPC-05: Premature Status of Semantic Mappings (e.g. `CANCELLED → VOID`)

- **Previous Statement:**  
  *"CANCELLED maps to VOID in target schema."*
- **Source Artifact:**  
  `11_PROMPT_12_5_ENUM_MAPPING_MATRIX.md:73` and early summary tables.
- **Live Evidence / Architecture Authority:**  
  Target Revision 4 defines `VOID` on `InvoiceStatus`, but no ADR or Owner decision has formally authorized converting legacy cancelled invoices to `VOID`.
- **Corrected Statement:**  
  `CANCELLED → VOID` is strictly a **MAPPING CANDIDATE — OWNER DECISION REQUIRED (ODR-03)**. It is not an approved migration mapping.
- **Reason for Correction:**  
  In accordance with Section 3.3 of Prompt 12.5-C, plausible semantic transformations must remain classified as candidates requiring explicit Owner authorization.

---

## 3. Provenance Summary Table

| Entry ID | Affected Enum / Entity | Nature of Discrepancy | Prior Incorrect Claim | Reconciled Ground Truth | Authoritative Ground Source |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **EPC-01** | `TenantStatus` | Fictitious label (`INACTIVE`) | Catalog had `INACTIVE`, target added `CANCELLED` | Catalog has `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING`. Target labels are 100% exact matches. | `pos_db` `pg_enum`, `04_TARGET_DATABASE_SCHEMA.md:859` |
| **EPC-02** | `InvoiceStatus` | Foreign enum terminology | Target has `SubscriptionInvoiceStatus` | Target has `InvoiceStatus { DRAFT, UNPAID, PAID, VOID }`. | `04_TARGET_DATABASE_SCHEMA.md:878`, `server/prisma/schema.prisma:774` |
| **EPC-03** | `Role` | Catalog label omission | Catalog lacked `SUPERVISOR` | Catalog already has `SUPERVISOR` at sort order 2 (EXACT match). | `pos_db` `pg_enum`, `04_TARGET_DATABASE_SCHEMA.md:891` |
| **EPC-04** | `PaymentStatus` | Catalog label assumption | Catalog had `UNPAID` | Catalog has only 3 labels (`PAID, CANCELLED, REFUNDED`). `UNPAID` is target additive. | `pos_db` `pg_enum`, `04_TARGET_DATABASE_SCHEMA.md:970` |
| **EPC-05** | Mapping Status | Premature approval | Semantic transforms treated as approved | All semantic transforms are classified as Candidates (ODR required). | Prompt 12.5-C Section 3.3 & ADR governance rules |
