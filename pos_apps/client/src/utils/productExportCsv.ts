import type { Product } from '../types/product';

/**
 * Helper untuk mengamankan nilai sel CSV (escape quotes dan string delimiter)
 */
const escapeCell = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Ekspor Seluruh Katalog Produk ke Berkas CSV / Excel (UTF-8 BOM)
 */
export const exportProductsToCsv = (
  products: Product[],
  filenamePrefix: string = 'katalog_produk_wellpos',
  onError?: (msg: string) => void
): boolean => {
  if (!products || products.length === 0) {
    if (onError) {
      onError('Tidak ada data produk untuk diekspor.');
    }
    return false;
  }

  // Header Kolom CSV
  const headers = [
    'No',
    'Nama Produk',
    'SKU',
    'Barcode',
    'Kategori',
    'Harga Jual (Rp)',
    'Modal HPP (Rp)',
    'Satuan',
    'Stok Saat Ini',
    'Batas Min Stok',
    'Status Aktif',
    'Deskripsi',
  ];

  // Baris-baris data produk
  const rows = products.map((p, idx) => {
    const variant = p.variants?.[0];
    const sku = p.sku || variant?.sku || '-';
    const barcode = p.barcode || variant?.barcode || '-';
    const basePrice = Number(variant?.price ?? p.basePrice ?? p.price ?? 0);
    const costPrice = Number(p.costPrice ?? 0);
    const stock = Number(p.stock ?? 0);
    const minAlert = Number(p.minStockAlert ?? 5);
    const categoryName = p.category?.name || 'Umum';
    const unit = p.unit || 'Pcs';
    const statusStr = p.isActive !== false ? 'AKTIF' : 'NONAKTIF';
    const desc = p.description || '';

    return [
      idx + 1,
      p.name,
      sku,
      barcode,
      categoryName,
      basePrice,
      costPrice,
      unit,
      stock,
      minAlert,
      statusStr,
      desc,
    ].map(escapeCell).join(',');
  });

  // Gabungkan dengan UTF-8 BOM (\uFEFF) untuk kompatibilitas sempurna di Microsoft Excel
  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadLink.download = `${filenamePrefix}_${dateTag}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);

  return true;
};

/**
 * Unduh Lembar Template Kosong CSV untuk Impor Massal Produk
 */
export const downloadProductImportTemplate = (): void => {
  const headers = [
    'Nama Produk',
    'SKU',
    'Barcode',
    'Kategori',
    'Harga Jual',
    'Modal HPP',
    'Satuan',
    'Stok Awal',
    'Batas Min Stok',
    'Deskripsi',
  ];

  const sampleRows = [
    [
      'Kopi Susu Gula Aren',
      'KPS-001',
      '8991001001',
      'Minuman',
      18000,
      7500,
      'Cup',
      50,
      10,
      'Espresso susu segar gula aren asli',
    ],
    [
      'Croissant Butter Keju',
      'BAK-002',
      '8991001002',
      'Bakery',
      24000,
      11000,
      'Pcs',
      25,
      5,
      'Roti croissant panggang isi keju gurih',
    ],
    [
      'Teh Earl Grey Dingin',
      'TEA-003',
      '8991001003',
      'Minuman',
      15000,
      4000,
      'Cup',
      40,
      10,
      'Teh hitam beraroma bergamot segar',
    ],
  ];

  const csvContent =
    '\uFEFF' +
    [
      headers.map(escapeCell).join(','),
      ...sampleRows.map((r) => r.map(escapeCell).join(',')),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'template_impor_produk_wellpos.csv';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};
