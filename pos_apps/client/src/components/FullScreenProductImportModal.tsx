import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { downloadProductImportTemplate } from '../utils/productExportCsv';
import { formatRupiah } from '../utils/currency';

interface ParsedProductRow {
  rowNumber: number;
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  basePrice: number;
  costPrice: number;
  unit: string;
  initialStock: number;
  minStockAlert: number;
  description: string;
  isValid: boolean;
  errors: string[];
}

interface FullScreenProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  outletId?: string;
  existingSkus?: Set<string>;
}

export const FullScreenProductImportModal: React.FC<FullScreenProductImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  outletId,
  existingSkus = new Set(),
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ sku: string; name: string; error: string }>;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  if (!isOpen) return null;

  // Parser CSV sederhana & tangguh yang mendukung tanda kutip, koma, titik koma, dan enter
  const parseCSV = (text: string): string[][] => {
    // Hapus UTF-8 BOM jika ada
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuote = false;

    // Deteksi pemisah (koma atau titik koma) dari baris pertama
    const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || '';
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          // Escaped quote: ""
          currentCell += '"';
          i++;
        } else {
          // Toggle inside quotes
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        lines.push(currentRow);
      }
    }

    return lines;
  };

  const handleProcessFile = (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    setFeedback(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('Berkas kosong');
        }

        const rawMatrix = parseCSV(text);
        if (rawMatrix.length <= 1) {
          throw new Error('Berkas tidak memiliki baris data produk (hanya header atau kosong).');
        }

        // Header mapping
        const headers = rawMatrix[0].map((h) => h.toLowerCase().trim());
        const findColIndex = (...candidates: string[]) => {
          return headers.findIndex((h) => candidates.some((c) => h.includes(c)));
        };

        const nameIdx = findColIndex('nama produk', 'nama', 'product name');
        const skuIdx = findColIndex('sku', 'kode produk', 'item code');
        const barcodeIdx = findColIndex('barcode', 'kode batang');
        const categoryIdx = findColIndex('kategori', 'category');
        const basePriceIdx = findColIndex('harga jual', 'harga', 'price', 'selling price');
        const costPriceIdx = findColIndex('modal', 'hpp', 'cost price', 'cost');
        const unitIdx = findColIndex('satuan', 'unit', 'uom');
        const stockIdx = findColIndex('stok awal', 'stok', 'stock', 'initial stock');
        const minAlertIdx = findColIndex('batas min', 'min stok', 'min stock', 'alert');
        const descIdx = findColIndex('deskripsi', 'keterangan', 'description');

        const rows: ParsedProductRow[] = [];

        for (let i = 1; i < rawMatrix.length; i++) {
          const rawRow = rawMatrix[i];
          // Abaikan baris kosong
          if (rawRow.every((c) => !c || c.trim() === '')) continue;

          const rowNum = i + 1;
          const name = nameIdx >= 0 ? rawRow[nameIdx] || '' : rawRow[0] || '';
          const sku = skuIdx >= 0 ? rawRow[skuIdx] || '' : rawRow[1] || '';
          const barcode = barcodeIdx >= 0 ? rawRow[barcodeIdx] || '' : '';
          const categoryName = categoryIdx >= 0 ? rawRow[categoryIdx] || '' : '';

          const parseNumber = (val: string | undefined): number => {
            if (!val) return 0;
            const cleaned = val.replace(/[^0-9.-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : Math.max(0, num);
          };

          const basePrice = basePriceIdx >= 0 ? parseNumber(rawRow[basePriceIdx]) : 0;
          const costPrice = costPriceIdx >= 0 ? parseNumber(rawRow[costPriceIdx]) : 0;
          const unit = unitIdx >= 0 ? rawRow[unitIdx] || 'Pcs' : 'Pcs';
          const initialStock = stockIdx >= 0 ? parseNumber(rawRow[stockIdx]) : 0;
          const minStockAlert = minAlertIdx >= 0 ? parseNumber(rawRow[minAlertIdx]) : 5;
          const description = descIdx >= 0 ? rawRow[descIdx] || '' : '';

          const errors: string[] = [];
          if (!name.trim()) errors.push('Nama produk wajib diisi');
          if (!sku.trim()) errors.push('SKU wajib diisi');

          rows.push({
            rowNumber: rowNum,
            name: name.trim(),
            sku: sku.trim(),
            barcode: barcode.trim(),
            categoryName: categoryName.trim(),
            basePrice,
            costPrice,
            unit: unit.trim() || 'Pcs',
            initialStock,
            minStockAlert,
            description: description.trim(),
            isValid: errors.length === 0,
            errors,
          });
        }

        if (rows.length === 0) {
          throw new Error('Tidak ada baris data produk yang valid ditemukan.');
        }

        setParsedRows(rows);
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err.message || 'Gagal memproses berkas CSV. Pastikan format tabel sesuai template.',
        });
        setParsedRows([]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Gagal membaca berkas dari perangkat Anda.' });
      setIsParsing(false);
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const updateRowsCount = validRows.filter((r) => existingSkus.has(r.sku)).length;
  const newRowsCount = validRows.length - updateRowsCount;

  const handleExecuteImport = async () => {
    if (validRows.length === 0) {
      setFeedback({ type: 'error', message: 'Tidak ada baris produk valid yang dapat diimpor.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const itemsPayload = validRows.map((r) => ({
        name: r.name,
        sku: r.sku,
        barcode: r.barcode || null,
        categoryName: r.categoryName || null,
        costPrice: r.costPrice,
        basePrice: r.basePrice,
        unit: r.unit,
        description: r.description || null,
        initialStock: r.initialStock,
        minStockAlert: r.minStockAlert,
      }));

      const res = await api.bulkImportProducts({
        items: itemsPayload,
        outletId,
      });

      if (res.status === 'success' && res.data) {
        setImportResult(res.data);
        onSuccess();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Gagal menyimpan impor produk ke server.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan sistem saat mengimpor produk.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setParsedRows([]);
    setImportResult(null);
    setFeedback(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white w-full h-full sm:h-[92vh] sm:max-w-6xl mx-auto rounded-none sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-900 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Impor Massal Katalog Produk</h2>
              <p className="text-xs text-slate-500">
                Unggah spreadsheet CSV untuk menambahkan atau memperbarui ratusan SKU produk sekaligus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadProductImportTemplate}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-900 hover:bg-blue-50/50 text-blue-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Unduh format template CSV standar Well POS"
            >
              <Download className="w-3.5 h-3.5 text-blue-900" />
              <span>Unduh Template CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Tutup Form Impor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-3 flex items-center gap-2.5 text-xs font-bold shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {importResult ? (
            /* HASIL IMPORT SUKSES */
            <div className="p-8 max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-5 my-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-3xl mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Impor Produk Selesai!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Katalog produk Anda telah diperbarui secara aman dan otomatis tersinkronisasi.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <div className="text-2xl font-black text-slate-900">{importResult.total}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">Total Baris</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-600">{importResult.created}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">Produk Baru</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-blue-600">{importResult.updated}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">Diperbarui</div>
                </div>
              </div>

              {importResult.failed > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{importResult.failed} baris terlewati karena terjadi error:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {importResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        SKU {err.sku}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Impor Berkas Lain
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-md shadow-blue-900/20 transition-all cursor-pointer"
                >
                  Selesai &amp; Kembali ke Katalog
                </button>
              </div>
            </div>
          ) : parsedRows.length === 0 ? (
            /* DROPZONE UPLOAD FILE */
            <div className="max-w-2xl mx-auto space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-blue-900 bg-blue-50/70 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-900/50 bg-white hover:bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                  {isParsing ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8" />
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900">
                  {isParsing ? 'Membaca data spreadsheet...' : 'Tarik & Letakkan Berkas CSV di Sini'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Atau klik untuk memilih berkas dari komputer Anda (Format file: <strong>.csv</strong>).
                </p>

                <div className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-xs transition-all">
                  <FileText className="w-4 h-4" />
                  <span>Pilih Berkas CSV</span>
                </div>
              </div>

              {/* Tips Petunjuk Kolom */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Kolom Wajib</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    <strong>Nama Produk</strong> &amp; <strong>SKU</strong> harus selalu terisi pada tiap baris.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Auto Kategori</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Jika nama kategori baru belum ada, sistem akan otomatis membuatkannya untuk Anda.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Cerdas Update (Upsert)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    SKU yang sudah ada akan otomatis diperbarui harganya tanpa membuat duplikat.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW TABEL HASIL PARSE */
            <div className="space-y-4">
              {/* Metrics Summary Strip */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-slate-500">Berkas:</div>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-extrabold rounded-lg font-mono">
                    {fileName}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-slate-600">
                    Total: <strong>{parsedRows.length}</strong>
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Baru: <strong>{newRowsCount}</strong>
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                    Pembaruan: <strong>{updateRowsCount}</strong>
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      Error: <strong>{invalidRows.length}</strong>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ganti Berkas</span>
                </button>
              </div>

              {invalidRows.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Ditemukan {invalidRows.length} baris tidak lengkap (Nama atau SKU kosong). Baris yang error akan otomatis dilewati saat proses impor.
                  </span>
                </div>
              )}

              {/* Table Preview */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 font-black uppercase tracking-wider border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3 w-28">Status</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Nama Produk</th>
                        <th className="py-2.5 px-3 min-w-[110px]">SKU</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Barcode</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Kategori</th>
                        <th className="py-2.5 px-3 text-right min-w-[100px]">Harga Jual</th>
                        <th className="py-2.5 px-3 text-right min-w-[100px]">Modal HPP</th>
                        <th className="py-2.5 px-3 text-center min-w-[70px]">Satuan</th>
                        <th className="py-2.5 px-3 text-center min-w-[70px]">Stok Awal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((row) => {
                        const isUpdate = existingSkus.has(row.sku);
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-slate-50 transition-colors ${
                              !row.isValid ? 'bg-rose-50/40 text-rose-900' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">
                              {row.rowNumber}
                            </td>
                            <td className="py-2 px-3">
                              {!row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded">
                                  Error
                                </span>
                              ) : isUpdate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                                  Update
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                                  Baru
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.name || <span className="text-rose-500 italic">Kosong</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {row.sku || <span className="text-rose-500 italic">Kosong</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">
                              {row.barcode || <span className="text-slate-400">-</span>}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                                {row.categoryName || 'Umum'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-900">
                              {formatRupiah(row.basePrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-600">
                              {formatRupiah(row.costPrice)}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600 font-medium">
                              {row.unit}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-800">
                              {row.initialStock}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && parsedRows.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              Siap memproses <strong>{validRows.length}</strong> produk valid
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isSubmitting || validRows.length === 0}
                className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-blue-900/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sedang Mengimpor ({validRows.length} Produk)...</span>
                  </>
                ) : (
                  <>
                    <span>Mulai Impor {validRows.length} Produk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
