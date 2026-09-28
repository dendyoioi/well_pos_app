# 11_PROMPT_12_5_ENUM_USAGE_INVENTORY.md
## Enum Usage & Dependency Inventory

### 1. Database Usage Inventory (`pos_db`)

| Enum Name | Table | Column | Nullable | Default Expression | Existing Constraints | Indexes | Views / Triggers / Functions |
|---|---|---|---|---|---|---|---|
| `PlatformRole` | `platform_users` | `role` | NO | `'SUPER_ADMIN'::"PlatformRole"` | PK on `id` | None | None |
| `TenantStatus` | `tenants` | `status` | NO | `'TRIAL'::"TenantStatus"` | PK on `id` | None | None |
| `InvoiceStatus` | `saas_invoices` | `status` | NO | `'UNPAID'::"InvoiceStatus"` | PK on `id`, FK to `tenants(id)`, FK to `subscription_plans(id)` | None | None |
| `Role` | `users` | `role` | NO | `'CASHIER'::"Role"` | PK on `id`, FK to `tenants(id)`, FK to `outlets(id)` | None | None |
| `StockMovementType` | `stock_movements` | `type` | NO | None | PK on `id`, FK to `outlets(id)`, FK to `products(id)`, FK to `users(id)` | None | None |
| `PaymentStatus` | `orders` | `payment_status` | NO | `'PAID'::"PaymentStatus"` | PK on `id`, FK to `outlets(id)`, FK to `users(cashier_id)`, FK to `shifts(id)` | None | None |
| `PaymentMethod` | `payments` | `method` | NO | None | PK on `id`, FK to `orders(id)` | None | None |
| `PaymentTxStatus` | `payments` | `status` | NO | `'SUCCESS'::"PaymentTxStatus"` | PK on `id`, FK to `orders(id)` | None | None |

---

### 2. Application Dependency Inventory

#### 2.1 `PlatformRole`
- **Prisma Model**: `PlatformUser.role` (`server/prisma/schema.prisma:29`)
- **Backend Usage**:
  - `server/src/controllers/platform.controller.ts`: Used in authentication and platform administration endpoints (`PlatformUser` CRUD).
- **Frontend Usage**:
  - `client/src/pages/SuperadminDashboardPage.tsx`: Referenced in role badges and superadmin permissions.
- **Dependency Summary**: Low row count (1 user), but high security criticality (platform-level authorization).

#### 2.2 `TenantStatus`
- **Prisma Model**: `Tenant.status` (`server/prisma/schema.prisma:41`)
- **Backend Usage**:
  - `server/src/controllers/saas.controller.ts:110`: When a new merchant self-registers, creates tenant with `status: TenantStatus.PENDING`.
  - `server/src/controllers/platform.controller.ts:17, 160-162, 213, 297, 507`:
    - Validates status with `z.nativeEnum(TenantStatus)`.
    - Aggregates tenant metrics by status: `ACTIVE`, `TRIAL`, `SUSPENDED`.
    - Endpoint `updateTenantStatus` (`PUT /api/platform/tenants/:id/status`) updates status to `TRIAL`, `ACTIVE`, etc.
  - `server/src/routes/platform.routes.ts:24-25`: Routes for tenant status updates.
- **Frontend Usage**:
  - `client/src/services/api.ts:748`: `updateTenantStatus(id, status, notes)`.
  - `client/src/pages/SuperadminDashboardPage.tsx:238, 273`:
    - "Approve Tenant" action calls `api.updateTenantStatus(tenantId, 'TRIAL', ...)` from `PENDING`.
- **Dependency Summary**: High operational criticality. Direct coupling to merchant onboarding and SaaS approval workflow.

#### 2.3 `InvoiceStatus`
- **Prisma Model**: `SaaSInvoice.status` (`server/prisma/schema.prisma:126`)
- **Backend Usage**:
  - Model exists in `schema.prisma` with `@default(UNPAID)`.
  - Currently zero direct runtime controller usage in `server/src/controllers/` (feature planned for automated subscription billing).
- **Frontend Usage**:
  - Not yet wired to active user screens; referenced in data contracts.
- **Dependency Summary**: Zero active database records in `pos_db`; minimal immediate runtime exposure, but core to SaaS billing roadmap.

#### 2.4 `Role`
- **Prisma Model**: `User.role` (`server/prisma/schema.prisma:63`)
- **Backend Usage**:
  - `server/src/middlewares/auth.middleware.ts:3, 88, 97`: Core RBAC gate: `authorize(...allowedRoles: Role[])`.
  - `server/src/routes/user.routes.ts:17, 20, 21, 22`: `authorize(Role.ADMIN, Role.SUPERVISOR)`, `authorize(Role.ADMIN)`.
  - `server/src/controllers/user.controller.ts:12, 21`: Zod schema validation `z.nativeEnum(Role)`.
  - `server/src/controllers/outlet.controller.ts:121, 127, 282, 306`: Role permission checks for outlet configuration.
  - `server/src/controllers/saas.controller.ts:139, 148, 308`: Assigns `Role.ADMIN` to tenant owner upon signup, and `Role.CASHIER` to default staff.
  - `server/src/controllers/platform.controller.ts:366-368`: Explicit query comment: `// Cari pemilik tenant (Role.ADMIN adalah Owner) where: { tenantId: id, role: Role.ADMIN }`.
- **Frontend Usage**:
  - `client/src/types/auth.ts:1`: `export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'WAREHOUSE' | 'CASHIER';`
  - `client/src/pages/DashboardPage.tsx:52, 59, 82, 189, 335, 683, 694, 921`: Dedicated UI layout and dashboard routing for `WAREHOUSE`:
    - `WAREHOUSE: ['inventory', 'products', 'overview']`
    - `<span>Ringkasan {user.role === 'WAREHOUSE' ? 'Gudang' : 'Toko'}</span>`
  - `client/src/pages/UsersView.tsx:221, 242, 354, 368, 607, 733`: Dropdown and filter for `WAREHOUSE` ("Staf Gudang (Stok & Mutasi)").
- **Dependency Summary**: Critical system-wide dependency across backend RBAC, API routes, and frontend routing/navigation.

#### 2.5 `StockMovementType`
- **Prisma Model**: `StockMovement.type` (`server/prisma/schema.prisma:188`)
- **Backend Usage**:
  - `server/src/controllers/product.controller.ts:330`: Initial stock creation records `StockMovementType.PURCHASE_IN`.
  - `server/src/controllers/order.controller.ts:389`: Order payment stock deduction records `StockMovementType.SALE_OUT`.
  - `server/src/controllers/inventory.controller.ts:106, 196, 281, 515, 530`:
    - Purchase: `PURCHASE_IN`
    - Damage: `DAMAGE_OUT`
    - Stock Opname: `ADJUSTMENT`
    - Inter-outlet transfer: `TRANSFER_OUT` and `TRANSFER_IN`
  - `server/src/controllers/saas.controller.ts:393, 407`: Sample product provisioning seeds `ADJUSTMENT`.
- **Frontend Usage**:
  - `client/src/pages/InventoryView.tsx`: Displays movement history badges, movement creation dialogs, and mutation types.
- **Dependency Summary**: Fundamental to legacy inventory tracking. In Target Revision 4, this is superseded by the `InventoryLedger` architecture.

#### 2.6 `PaymentStatus`
- **Prisma Model**: `Order.paymentStatus` (`server/prisma/schema.prisma:243`)
- **Backend Usage**:
  - `server/src/controllers/order.controller.ts:3, 340`: Sets `paymentStatus: PaymentStatus.PAID` upon transaction completion.
  - `server/src/controllers/report.controller.ts:60`: Aggregates revenue filtering by `paymentStatus: PaymentStatus.PAID`.
- **Frontend Usage**:
  - `client/src/pages/OrdersView.tsx`: Displays payment status badges.
- **Dependency Summary**: Merges order fulfillment and payment confirmation in the legacy model.

#### 2.7 `PaymentMethod`
- **Prisma Model**: `Payment.method` (`server/prisma/schema.prisma:264`)
- **Backend Usage**:
  - `server/src/controllers/order.controller.ts:16, 260, 289, 299`: Validates payment method (`CASH` vs `QRIS`); calculates change for `CASH`.
  - `server/src/controllers/shift.controller.ts:135, 138, 224, 226, 331, 333, 483, 485`: Summarizes shift cash drawer balances vs non-cash (`QRIS`) totals.
  - `server/src/controllers/report.controller.ts:152, 155, 218`: Splits sales breakdown by `CASH` and `QRIS`.
- **Frontend Usage**:
  - `client/src/pages/PosView.tsx`: Cash payment dialog (with numpad and quick cash denominations) and QRIS modal (QR code rendering).
- **Dependency Summary**: Deeply coupled to POS checkout UI and cash register shift closing reconciliation.

#### 2.8 `PaymentTxStatus`
- **Prisma Model**: `Payment.status` (`server/prisma/schema.prisma:268`)
- **Backend Usage**:
  - `server/src/controllers/order.controller.ts:264, 276, 306`: Sets `status: PaymentTxStatus.SUCCESS` when a payment is processed.
- **Frontend Usage**:
  - Checked on transaction receipts and receipt printing logic.
- **Dependency Summary**: Represents gateway transaction state in legacy `payments` table.
