import React, { useState } from 'react';
import {
  Store,
  Printer,
  UserCheck,
  PackageCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  X,
  Phone,
  Warehouse,
  Info,
  Eye,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatIndonesianWhatsApp } from '../../utils/phone';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose?: () => void;
  outletId: string;
  businessName: string;
  onComplete: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  outletId,
  businessName,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tooltip active popup state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Step 1: Profil Toko & WhatsApp
  const [address, setAddress] = useState('Jl. Gatot Subroto No. 45, Jakarta Selatan');
  const [phone, setPhone] = useState('+6281234567890');

  // Step 2: Setup Gudang Utama (Wajib / Mandatory)
  const [warehouseName, setWarehouseName] = useState(`Gudang Utama - ${businessName}`);
  const [sameAsStoreAddress, setSameAsStoreAddress] = useState(true);
  const [warehouseAddress, setWarehouseAddress] = useState('Sentral Logistik & Gudang');

  // Step 3: Ukuran Struk Default Kasir
  const [receiptSize, setReceiptSize] = useState<'58mm' | '80mm'>('58mm');
  const [receiptFooter, setReceiptFooter] = useState(
    `Terima kasih telah berbelanja di ${businessName}! Simpan struk ini sebagai bukti transaksi resmi.`
  );

  // Step 4: Akun Kasir Pertama
  const [cashierName, setCashierName] = useState('Rian (Kasir 1)');
  const [cashierPin, setCashierPin] = useState('123456');

  // Step 5: 1 Produk Pertama Terpandu & Alokasi Saldo Awal (Toko vs Gudang)
  const [productName, setProductName] = useState('Kopi Susu Gula Aren');
  const [categoryName, setCategoryName] = useState('Minuman');
  const [unit, setUnit] = useState('Cup');
  const [costPrice, setCostPrice] = useState('8000');
  const [basePrice, setBasePrice] = useState('18000');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [storeStock, setStoreStock] = useState('20');
  const [warehouseStock, setWarehouseStock] = useState('80');

  if (!isOpen) return null;

  const totalOpeningStock = isUnlimited
    ? 0
    : (parseInt(storeStock.replace(/\D/g, ''), 10) || 0) +
      (parseInt(warehouseStock.replace(/\D/g, ''), 10) || 0);

  const handleFinishOnboarding = async () => {
    setError(null);

    if (!productName.trim()) {
      setError('Harap isi nama produk pertama Anda');
      return;
    }

    if (!warehouseName.trim()) {
      setError('Harap isi nama gudang utama Anda');
      return;
    }

    setLoading(true);

    try {
      const parsedStoreStock = parseInt(storeStock.replace(/\D/g, ''), 10) || 0;
      const parsedWarehouseStock = parseInt(warehouseStock.replace(/\D/g, ''), 10) || 0;

      const res = await api.saasOnboard({
        outletId,
        address,
        phone,
        warehouse: {
          name: warehouseName.trim(),
          address: sameAsStoreAddress ? address : warehouseAddress.trim(),
          phone,
        },
        receiptSize,
        receiptFooter,
        cashierName,
        cashierPin,
        initialProduct: {
          name: productName.trim(),
          categoryName: categoryName.trim() || 'Umum',
          unit: unit.trim() || 'Pcs',
          costPrice: parseInt(costPrice.replace(/\D/g, ''), 10) || 0,
          basePrice: parseInt(basePrice.replace(/\D/g, ''), 10) || 0,
          storeStock: isUnlimited ? 999999 : parsedStoreStock,
          warehouseStock: isUnlimited ? 999999 : parsedWarehouseStock,
          initialStock: isUnlimited ? 999999 : parsedStoreStock,
          isUnlimited,
        },
      });

      if (res.status === 'success') {
        onComplete();
      } else {
        setError(res.message || 'Gagal menyimpan pengaturan onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses onboarding');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiahInput = (val: string) => {
    const num = val.replace(/\D/g, '');
    return num ? new Intl.NumberFormat('id-ID').format(parseInt(num, 10)) : '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative">
        {/* Header Wizard & Progress Bar */}
        <div className="p-6 bg-gradient-to-r from-blue-950 to-blue-900 text-white relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 text-blue-300 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Tutup Wizard (Lanjutkan Setup Nanti)"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center justify-between mb-3 pr-8">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-800 text-blue-200 flex items-center justify-center text-xs font-black">
                {step}/5
              </span>
              <h3 className="font-black text-base sm:text-lg">
                Setup Awal & Onboarding Toko
              </h3>
            </div>
            <span className="text-xs font-bold text-blue-200 bg-blue-800/80 px-2.5 py-1 rounded-full">
              {businessName}
            </span>
          </div>

          <p className="text-xs text-blue-200/80 leading-relaxed">
            Selesaikan 5 langkah panduan mudah berikut untuk mengonfigurasi profil cabang, gudang utama, printer struk, kasir, dan alokasi stok perdana Anda.
          </p>

          {/* Stepper Dots & Labels */}
          <div className="grid grid-cols-5 gap-1.5 mt-4">
            {[
              { num: 1, label: 'Profil Toko' },
              { num: 2, label: 'Gudang Utama' },
              { num: 3, label: 'Ukuran Struk' },
              { num: 4, label: 'Akun Kasir' },
              { num: 5, label: '1 Produk Awal' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    step >= s.num ? 'bg-emerald-400' : 'bg-blue-800/60'
                  }`}
                />
                <span
                  className={`text-[9.5px] truncate font-semibold ${
                    step === s.num ? 'text-white' : 'text-blue-300/70'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* STEP 1: PROFIL TOKO & WHATSAPP */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b pb-2">
                <Store className="w-4 h-4 text-blue-900" />
                <span>Langkah 1: Identitas & Kontak Toko Utama</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Fisik Toko / Outlet:
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nama jalan, nomor gedung, kelurahan/kecamatan, kota"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Alamat ini akan otomatis tercetak di header struk kasir dan faktur penjualan.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nomor WhatsApp / Telepon Toko:</span>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Format +62 (Maks 13 Digit)
                  </span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatIndonesianWhatsApp(e.target.value))}
                    placeholder="+6281234567890"
                    maxLength={14}
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Diawali 0 / 8 otomatis diformat ke <span className="font-semibold text-slate-700">+62</span> (angka 0 dihilangkan). Tercetak di struk untuk nomor hotline pelanggan.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: SETUP GUDANG UTAMA (MANDATORY) */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                  <Warehouse className="w-4 h-4 text-blue-900" />
                  <span>Langkah 2: Setup Gudang Utama (Wajib / Mandatory)</span>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Pusat Logistik
                </span>
              </div>

              {/* Card Edukasi Gudang */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-950">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-900">
                    Mengapa Bisnis Anda Wajib Memiliki Gudang?
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Sistem POS membedakan secara fisik antara <span className="font-bold">Stok di Etalase Toko</span> (siap dijual kasir) dan <span className="font-bold">Stok Cadangan di Gudang</span> (penyimpanan dus/supplier). Pengadaan barang di masa depan akan ditampung di gudang ini sebelum ditransfer ke toko.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Gudang Utama *
                </label>
                <input
                  type="text"
                  required
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                  placeholder="misal: Gudang Utama Toko / Gudang Pusat"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama identitas lokasi penyimpanan stok cadangan pusat Anda.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsStoreAddress}
                    onChange={(e) => setSameAsStoreAddress(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 focus:ring-blue-800"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Lokasi gudang berada di alamat yang sama dengan toko
                  </span>
                </label>

                {!sameAsStoreAddress && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Fisik Gudang Terpisah:
                    </label>
                    <textarea
                      rows={2}
                      value={warehouseAddress}
                      onChange={(e) => setWarehouseAddress(e.target.value)}
                      placeholder="Alamat gudang / pusat logistik terpisah..."
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl p-2.5 text-xs font-medium outline-none resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: UKURAN STRUK & PRINTER DEFAULT */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b pb-2">
                <Printer className="w-4 h-4 text-blue-900" />
                <span>Langkah 3: Ukuran Printer Struk Default</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Pilih Ukuran Kertas Struk Default:</span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                    Otomatis Default di Kasir
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setReceiptSize('58mm')}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      receiptSize === '58mm'
                        ? 'bg-blue-50/80 border-blue-900 text-blue-950 shadow-sm ring-1 ring-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>58mm (Printer Mini / Portable)</span>
                      {receiptSize === '58mm' && <CheckCircle className="w-4 h-4 text-blue-900" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Cocok untuk printer Bluetooth portable, kasir mobile Android/tablet, atau space counter sempit.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptSize('80mm')}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      receiptSize === '80mm'
                        ? 'bg-blue-50/80 border-blue-900 text-blue-950 shadow-sm ring-1 ring-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>80mm (Printer Desktop / Besar)</span>
                      {receiptSize === '80mm' && <CheckCircle className="w-4 h-4 text-blue-900" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Standar printer meja counter kasir kabel USB/LAN (Epson TM, Sunmi, Xprinter). Informasi lebih lega.
                    </p>
                  </button>
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl mt-3 flex items-start gap-2 text-xs text-blue-950">
                  <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-bold">Fleksibel:</span> Pilihan ini akan menjadi <span className="font-bold">nilai default</span> saat kasir mencetak struk. Kasir tetap dapat mengganti ukuran struk secara langsung kapan saja di modal cetak.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pesan Kaki / Footer Struk:
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Pesan penutup atau ucapan terima kasih di bawah struk..."
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 4: AKUN KASIR PERTAMA */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b pb-2">
                <UserCheck className="w-4 h-4 text-blue-900" />
                <span>Langkah 4: Akun Staf Kasir Pertama</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Staf Kasir:
                </label>
                <input
                  type="text"
                  required
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="misal: Rian (Kasir 1)"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN Kasir Cepat (6 Digit Angka):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={cashierPin}
                  onChange={(e) => setCashierPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-base tracking-widest font-black outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Kasir dapat langsung login ke layar POS di counter hanya dengan memasukkan 6 digit PIN ini.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: 1 PRODUK PERTAMA & ALOKASI SALDO AWAL (TOKO VS GUDANG) */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                  <PackageCheck className="w-4 h-4 text-blue-900" />
                  <span>Langkah 5: Panduan 1 Produk Pertama & Alokasi Stok</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Dipandu Interaktif
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Buat <span className="font-bold text-slate-900">1 produk andalan pertama</span> toko Anda beserta alokasi Saldo Awal di rak kasir dan gudang cadangan:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Nama Produk */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Nama Produk *</label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'name' ? null : 'name')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                      title="Pelajari panduan nama produk"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="misal: Kopi Susu Gula Aren"
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                  />
                  {activeTooltip === 'name' && (
                    <div className="p-2 bg-blue-950 text-white rounded-lg text-[10px] mt-1 shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Panduan Nama Produk:</b> Berikan nama spesifik yang mudah dikenali kasir dan pelanggan saat dicetak di struk.
                    </div>
                  )}
                </div>

                {/* 2. Kategori Produk */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Kategori *</label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'category' ? null : 'category')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                      title="Pelajari fungsi kategori"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="misal: Minuman, Makanan, Retail"
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                  />
                  {activeTooltip === 'category' && (
                    <div className="p-2 bg-blue-950 text-white rounded-lg text-[10px] mt-1 shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Panduan Kategori:</b> Memudahkan filter tombol kasir per grup dan menghasilkan laporan omzet per kategori produk.
                    </div>
                  )}
                </div>

                {/* 3. Satuan Unit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Satuan Unit</label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'unit' ? null : 'unit')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value="Pcs">Pcs (Satuan Barang)</option>
                    <option value="Cup">Cup (Minuman)</option>
                    <option value="Porsi">Porsi (Makanan)</option>
                    <option value="Botol">Botol</option>
                    <option value="Bungkus">Bungkus</option>
                    <option value="Kg">Kilogram (Kg)</option>
                  </select>
                  {activeTooltip === 'unit' && (
                    <div className="p-2 bg-blue-950 text-white rounded-lg text-[10px] mt-1 shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Panduan Satuan:</b> Satuan kuantitas barang saat kasir menambahkan pesanan dan saat laporan inventory tercatat.
                    </div>
                  )}
                </div>

                {/* 4. HPP / Modal */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Harga Modal (HPP)</label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'cost' ? null : 'cost')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      value={formatRupiahInput(costPrice)}
                      onChange={(e) => setCostPrice(e.target.value.replace(/\D/g, ''))}
                      placeholder="8.000"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none"
                    />
                  </div>
                  {activeTooltip === 'cost' && (
                    <div className="p-2 bg-blue-950 text-white rounded-lg text-[10px] mt-1 shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Harga Pokok Penjualan (HPP):</b> Biaya modal bahan baku atau beli per unit. Digunakan untuk menghitung laba kotor & bersih otomatis.
                    </div>
                  )}
                </div>

                {/* 5. Harga Jual */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Harga Jual Kasir (Base Price) *</label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'price' ? null : 'price')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      required
                      value={formatRupiahInput(basePrice)}
                      onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ''))}
                      placeholder="18.000"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs font-bold outline-none text-emerald-700"
                    />
                  </div>
                  {activeTooltip === 'price' && (
                    <div className="p-2 bg-blue-950 text-white rounded-lg text-[10px] mt-1 shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Harga Jual:</b> Nilai transaksi yang dibayarkan pembeli sebelum pajak atau diskon diterapkan.
                    </div>
                  )}
                </div>

                {/* 6. Alokasi Saldo Awal (Toko vs Gudang) */}
                <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUnlimited}
                        onChange={(e) => setIsUnlimited(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-900 focus:ring-blue-800"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Produk Tanpa Pengurangan Stok (Jasa / Layanan / Menu Dibuat Langsung)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === 'stock' ? null : 'stock')}
                      className="text-slate-400 hover:text-blue-900 p-0.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isUnlimited ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Stok Toko */}
                      <div>
                        <label className="block text-[11px] font-bold text-blue-950 mb-1 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-blue-800" />
                          <span>Stok di Toko (Siap Jual Kasir):</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={storeStock}
                            onChange={(e) => setStoreStock(e.target.value)}
                            placeholder="20"
                            className="w-full bg-white border border-blue-200 focus:border-blue-900 text-slate-900 rounded-xl pl-3 pr-12 py-2 text-xs font-bold outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            {unit}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Langsung siap dipindai di mesin kasir.
                        </p>
                      </div>

                      {/* Stok Gudang */}
                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1 flex items-center gap-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-amber-700" />
                          <span>Stok Cadangan di Gudang:</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={warehouseStock}
                            onChange={(e) => setWarehouseStock(e.target.value)}
                            placeholder="80"
                            className="w-full bg-white border border-amber-200 focus:border-amber-700 text-slate-900 rounded-xl pl-3 pr-12 py-2 text-xs font-bold outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            {unit}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Tersimpan di {warehouseName || 'Gudang Utama'}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-blue-800 italic">
                      Produk ini tidak akan mengurangi stok inventory saat terjadi transaksi penjualan di kasir.
                    </p>
                  )}

                  {activeTooltip === 'stock' && (
                    <div className="p-2.5 bg-blue-950 text-white rounded-lg text-[10px] shadow-md leading-relaxed animate-in fade-in">
                      💡 <b>Panduan Pembagian Stok:</b> Memisahkan barang di rak toko agar kasir tidak over-selling melebihi fisik yang dipajang, sementara stok dus/buffer tersimpan aman di gudang logistik.
                    </div>
                  )}

                  {/* PREVIEW EDUKASI INTERAKTIF ALOKASI SALDO AWAL */}
                  {!isUnlimited && (
                    <div className="mt-3 p-3.5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-extrabold text-white tracking-wide uppercase">
                            Preview Alokasi Saldo Awal Produk
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Total Saldo: {totalOpeningStock} {unit}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                          <div className="flex items-center gap-1.5 text-blue-300 font-bold text-[11px] mb-1">
                            <Store className="w-3.5 h-3.5 text-blue-400" />
                            <span>Toko (Kasir)</span>
                          </div>
                          <div className="text-base font-black text-white">
                            {parseInt(storeStock.replace(/\D/g, ''), 10) || 0} <span className="text-xs font-normal text-slate-400">{unit}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                            Siap dipindai & langsung dijual kasir hari ini.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px] mb-1">
                            <Warehouse className="w-3.5 h-3.5 text-amber-400" />
                            <span>Gudang Utama</span>
                          </div>
                          <div className="text-base font-black text-white">
                            {parseInt(warehouseStock.replace(/\D/g, ''), 10) || 0} <span className="text-xs font-normal text-slate-400">{unit}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                            Buffer stok. Pindahkan ke toko via Transfer Stok.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-[10.5px] text-slate-300 space-y-1 leading-relaxed">
                        <p className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          <span>Tercatat resmi sebagai <b>Saldo Awal Produk</b> di Buku Besar Kartu Stok.</span>
                        </p>
                        <p className="text-slate-400">
                          💡 <b>Catatan Edukasi:</b> Pengadaan stok supplier berikutnya dilakukan melalui menu <b>Stok & Kartu Mutasi</b> (Penerimaan PO / Penyesuaian Stok).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Navigation Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              Lewati Setup (Nanti)
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinishOnboarding}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {loading ? (
                <span>Menyiapkan Sistem...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Selesaikan & Buka Mesin Kasir</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
