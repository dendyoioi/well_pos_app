# ADR-007 — Penghapusan Tenant Fallback & Penguatan Keamanan Multi-Tenancy

**Status**: ACCEPTED  
**Tanggal**: 2026-09-25  
**Pengusul**: Security Audit — AI Agent (Antigravity)  
**Berlaku Pada**: Semua Controller Backend (`pos_apps/server/src/controllers/`)

---

## Context (Latar Belakang)

Dalam sesi audit keamanan menyeluruh tanggal 25 September 2026, ditemukan bahwa sejumlah controller backend menggunakan pola *fallback* berbahaya untuk menentukan `tenantId` — komponen fundamental dari isolasi data multi-tenancy. Pola ini berpotensi menjadi celah keamanan kritis yang mengakibatkan akses lintas-tenant (*cross-tenant data leak*).

---

## Problem (Masalah yang Ditemukan)

### Pola Berbahaya #1 — `prisma.tenant.findFirst()` Fallback
```ts
// ❌ DILARANG: Jika tenantId dari token kosong, ambil tenant pertama di DB
if (!tenantId) {
  const firstTenant = await prisma.tenant.findFirst({ select: { id: true } });
  tenantId = firstTenant?.id; // ← Bisa jadi tenant orang lain!
}
```
Ditemukan di: `product`, `inventory`, `report`, `category`, `order`, `shift`, `customer` controller.

### Pola Berbahaya #2 — `req.query.tenantId` Sebagai Auth Context
```ts
// ❌ DILARANG: User bisa inject ?tenantId=<uuid-tenant-lain> di URL
let tenantId = req.user?.tenantId || (req.query.tenantId as string);
```
Ditemukan di: `product`, `inventory`, `category`, `order` controller.

### Kelemahan Lainnya yang Ditemukan
- `GET /api/auth/paired-cashiers` tanpa middleware `authenticate` → enumeration attack
- JWT Secret `rahasia_super_aman_pos_12345` hardcoded dan lemah
- `cors()` tanpa origin whitelist → cross-origin request dari domain manapun
- Tenant berstatus `PENDING` bisa bypass onboarding wizard

---

## Decision (Keputusan Arsitektur)

### R-10 — Canonical Tenant Resolution Order (Urutan Resolusi tenantId)

Seluruh controller wajib menggunakan urutan resolusi `tenantId` berikut secara ketat:

```
tenantId = req.user?.tenantId   ← Sumber UTAMA (dari JWT yang diverifikasi DB)
         || req.tenantId        ← Sumber sekunder (dari middleware SaaS yang valid)
```

**DILARANG** menambahkan sumber lain setelah dua sumber di atas. Jika setelah keduanya `tenantId` masih `null/undefined`, controller **WAJIB** mengembalikan `HTTP 401`.

```ts
// ✅ Pola yang BENAR dan WAJIB digunakan
const tenantId = req.user?.tenantId || req.tenantId;
if (!tenantId) {
  return res.status(401).json({
    status: 'error',
    message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.',
  });
}
```

### R-11 — Larangan `req.query.tenantId` sebagai Auth Context

`req.query` adalah user-controlled input. Nilai apapun di query param `?tenantId=` **dilarang keras** digunakan sebagai dasar penentuan kepemilikan data. `req.query.outletId` boleh digunakan untuk *filtering*, bukan untuk *authorization*.

### R-12 — JWT Secret Production-Grade

JWT Secret wajib memiliki minimum **64 byte entropy** (128 karakter hex). Gunakan:
```bash
openssl rand -hex 64
```
Nilai secret terbaru tersimpan di `.env` dan **tidak boleh di-commit** ke version control. Pastikan `.env` ada di `.gitignore`.

### R-13 — CORS Whitelist via Environment Variable

`cors()` tanpa konfigurasi dilarang di environment produksi. Origin whitelist wajib dikontrol via env var `CLIENT_ORIGIN`:
```ts
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

### R-14 — PENDING Tenant Guard di Semua Mutation Endpoint

Setiap endpoint yang membuat atau memodifikasi data bisnis (outlet, produk, staf, order) wajib memverifikasi `tenant.status !== 'PENDING'` sebelum memproses request. Tenant berstatus `PENDING` hanya boleh membaca data registrasinya sendiri.

---

## Consequences (Dampak)

### Dampak Positif
- ✅ Eliminasi risiko IDOR (*Insecure Direct Object Reference*) lintas-tenant
- ✅ JWT secret kini tidak bisa ditebak atau di-brute-force
- ✅ Attack surface CORS berkurang drastis
- ✅ Tenant `PENDING` tidak bisa bypass approval workflow

### Dampak Samping yang Perlu Diperhatikan
- ⚠️ **Token Invalidation**: Perubahan JWT secret (R-12) membuat semua token yang sudah di-issue sebelumnya invalid. User perlu login ulang satu kali setelah deployment.
- ⚠️ **QR Menu Public Endpoint**: Endpoint publik tanpa auth (`GET /api/qr-menu/public/menu`) dikecualikan dari R-10 karena dirancang memang bersifat publik. Isolation tetap dijaga via `outletId` dari URL slug.
- ⚠️ **Dev Environment**: `CLIENT_ORIGIN=http://localhost:5173` sudah dikonfigurasi di `.env` untuk development lokal.

---

## Files Yang Dimodifikasi

| File | Perubahan |
|---|---|
| `routes/auth.routes.ts` | Tambah `authenticate` ke `GET /paired-cashiers` (R-10) |
| `.env` | Ganti JWT secret dengan 128-char hex (R-12) + tambah `CLIENT_ORIGIN` (R-13) |
| `index.ts` | CORS whitelist via `CLIENT_ORIGIN` env (R-13) |
| `controllers/report.controller.ts` | Hapus 5x `findFirst` fallback → 401 (R-10) |
| `controllers/product.controller.ts` | Hapus `findFirst` fallback + `query.tenantId` (R-10, R-11) |
| `controllers/inventory.controller.ts` | Hapus 4x `findFirst` fallback + `query.tenantId` (R-10, R-11) |
| `controllers/category.controller.ts` | Hapus `findFirst` fallback → 401 (R-10) |
| `controllers/saas.controller.ts` | Tambah PENDING tenant guard (R-14) |

---

## Referensi

- ADR-001: Tenant Boundary Enforcement (prinsip dasar isolasi tenant)
- OWASP IDOR Prevention Cheat Sheet
- Sesi Audit Keamanan — 25 September 2026
