/**
 * Utilitas Deteksi Multi-Parameter Vertikal Industri Bisnis (Laundry & Dry Clean vs F&B / Retail)
 * 
 * SUMBER KEBENARAN UTAMA: `activeOutlet` (khususnya `outlet.industries` dan nama outlet aktif).
 * Jika `activeOutlet` secara eksplisit memiliki industri F&B/Retail dan tidak memuat Laundry,
 * fungsi WAJIB mengembalikan `false` agar owner dengan multi-outlet (Kafe + Laundry) terisolasi sempurna.
 */
export function checkIsLaundry(
  outlet?: any,
  user?: any,
  permissions?: any[]
): boolean {
  const LAUNDRY_KEYWORDS = ['laundry', 'cuci', 'dry clean', 'dryclean', 'binatu', 'kiloan'];
  const FNB_RETAIL_KEYWORDS = [
    'f&b', 'food', 'beverage', 'cafe', 'kafe', 'kopi', 'coffee',
    'resto', 'restaurant', 'kuliner', 'retail', 'toko', 'warung',
    'minimarket', 'bakery', 'bar', 'kedai', 'eatery'
  ];

  // 1. PRIORITAS TERTINGGI: Active Outlet (Industries & Nama Outlet Fisik)
  if (outlet) {
    const rawIndustries = outlet.industries;
    let industryList: string[] = [];

    if (Array.isArray(rawIndustries)) {
      industryList = rawIndustries
        .map((i: any) => (typeof i === 'string' ? i.toLowerCase().trim() : ''))
        .filter(Boolean);
    } else if (typeof rawIndustries === 'string') {
      try {
        const parsed = JSON.parse(rawIndustries);
        if (Array.isArray(parsed)) {
          industryList = parsed.map((i: any) => String(i).toLowerCase().trim()).filter(Boolean);
        } else {
          industryList = [rawIndustries.toLowerCase().trim()];
        }
      } catch {
        industryList = rawIndustries
          .toLowerCase()
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    if (industryList.length > 0) {
      const hasLaundryIndustry = industryList.some((ind) =>
        LAUNDRY_KEYWORDS.some((kw) => ind.includes(kw))
      );
      if (hasLaundryIndustry) return true;

      const hasFnbRetailIndustry = industryList.some((ind) =>
        FNB_RETAIL_KEYWORDS.some((kw) => ind.includes(kw))
      );
      // Jika outlet secara eksplisit adalah F&B / Retail dan tidak ada industri laundry, KUNCI mati ke false!
      if (hasFnbRetailIndustry) return false;
    }

    // Evaluasi nama outlet aktif jika industri belum disetel
    const outletName = (outlet.name || '').toLowerCase();
    if (LAUNDRY_KEYWORDS.some((kw) => outletName.includes(kw))) {
      return true;
    }
    if (FNB_RETAIL_KEYWORDS.some((kw) => outletName.includes(kw))) {
      return false;
    }
  }

  // 2. PRIORITAS KEDUA: Data Tenant Akun Pengguna (Fallback bila outlet belum dipilih/ditetapkan)
  if (user) {
    const tenant = user.tenant;
    const bType = (
      (tenant as any)?.businessType ||
      (user as any)?.businessType ||
      ''
    ).toLowerCase();
    const bVertical = (
      (tenant as any)?.businessVertical ||
      (user as any)?.businessVertical ||
      ''
    ).toUpperCase();

    if (LAUNDRY_KEYWORDS.some((kw) => bType.includes(kw)) || bVertical === 'SERVICES') {
      return true;
    }

    const tenantName = (
      (tenant as any)?.name ||
      (tenant as any)?.businessName ||
      ''
    ).toLowerCase();
    if (LAUNDRY_KEYWORDS.some((kw) => tenantName.includes(kw))) {
      return true;
    }

    // Evaluasi fallback outlet bawaan user (jika outlet aktif bernilai null)
    const userOutlet = (user as any).outlet;
    if (userOutlet && !outlet) {
      const uOutletName = (userOutlet.name || '').toLowerCase();
      if (LAUNDRY_KEYWORDS.some((kw) => uOutletName.includes(kw))) {
        return true;
      }
      if (FNB_RETAIL_KEYWORDS.some((kw) => uOutletName.includes(kw))) {
        return false;
      }
    }
  }

  // 3. PRIORITAS KETIGA: Wewenang Sistem (Hanya jika outlet tidak secara eksplisit terdaftar F&B)
  if (Array.isArray(permissions) && permissions.length > 0) {
    const hasLaundryPerm = permissions.some(
      (p: any) =>
        p?.category === 'LAUNDRY_OPERATIONS' ||
        (typeof p?.id === 'string' && p.id.startsWith('laundry_'))
    );
    if (hasLaundryPerm) return true;
  }

  return false;
}
