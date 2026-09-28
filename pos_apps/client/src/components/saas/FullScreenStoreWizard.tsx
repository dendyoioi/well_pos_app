import React, { useState, useMemo } from 'react';
import {
  Store,
  Building2,
  MapPin,
  Tag,
  Search,
  Check,
  X,
  Sparkles,
  ArrowRight,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { INDUSTRY_CATEGORIES } from '../../constants/industries';
import { WhatsAppInput } from '../ui';
import { validateIndonesianWhatsApp, formatIndonesianWhatsApp } from '../../utils/phone';

interface FullScreenStoreWizardProps {
  ownerName: string;
  ownerEmail: string;
  onStoreCreated: (storeData: any) => void;
  onLogout: () => void;
}

export const FullScreenStoreWizard: React.FC<FullScreenStoreWizardProps> = ({
  ownerName,
  ownerEmail,
  onStoreCreated,
  onLogout,
}) => {
  const [merchantName, setMerchantName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'Ritel' | 'Restoran' | 'Layanan'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flattened and filtered list of industries
  const filteredIndustries = useMemo(() => {
    let list: { category: string; name: string }[] = [];

    INDUSTRY_CATEGORIES.forEach((cat) => {
      if (activeTab === 'ALL' || cat.industryType === activeTab) {
        cat.industryNameList.forEach((name) => {
          list.push({ category: cat.industryType, name });
        });
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }

    return list;
  }, [activeTab, searchQuery]);

  const toggleIndustry = (name: string) => {
    if (selectedIndustries.includes(name)) {
      setSelectedIndustries(selectedIndustries.filter((item) => item !== name));
    } else {
      setSelectedIndustries([...selectedIndustries, name]);
    }
  };

  const removeIndustry = (name: string) => {
    setSelectedIndustries(selectedIndustries.filter((item) => item !== name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!merchantName.trim()) {
      setError('Nama Pedagang (Badan Usaha/Brand) wajib diisi.');
      return;
    }
    if (!storeName.trim()) {
      setError('Nama Toko / Outlet wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      setError('Nomor HP / WhatsApp Toko wajib diisi.');
      return;
    }

    const phoneValidation = validateIndonesianWhatsApp(phone.trim());
    if (!phoneValidation.isValid) {
      setError(phoneValidation.message || 'Format nomor HP / WhatsApp toko tidak valid.');
      return;
    }

    if (!address.trim()) {
      setError('Alamat Toko wajib diisi.');
      return;
    }
    if (selectedIndustries.length === 0) {
      setError('Pilih minimal satu tipe industri untuk toko Anda.');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatIndonesianWhatsApp(phone.trim());
      const res = await api.createInitialStore({
        merchantName: merchantName.trim(),
        storeName: storeName.trim(),
        phone: formattedPhone,
        address: address.trim(),
        industries: selectedIndustries,
      });

      if (res.status === 'success' && res.data) {
        onStoreCreated(res.data);
      } else {
        setError(res.message || 'Gagal membuat toko pertama. Silakan coba lagi.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat membuat toko.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Background subtle ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-sky-300/15 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar: Clean White-Blue SaaS Header */}
      <header className="relative z-10 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
            <Store className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900">WELL POS</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Setup Wizard
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Platform Kasir Multi-Store Indonesia</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-800">{ownerName}</p>
            <p className="text-[11px] text-slate-500">{ownerEmail}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-xs text-slate-600 font-medium transition-colors shadow-xs"
            title="Keluar / Ganti Akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-10">
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 sm:p-9 shadow-xl shadow-slate-200/60">
          {/* Header Banner */}
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-3.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Langkah Pertama Pemilik Toko</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Anda Belum Memiliki Toko Aktif
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Selamat bergabung di Well POS, <strong className="text-slate-800">{ownerName}</strong>! Silakan lengkapi profil usaha dan toko pertama Anda di bawah ini untuk langsung membuka dashboard operasional.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input 1: Nama Pedagang / Merchant */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Nama Pedagang / Merchant</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal normal-case text-slate-400">
                  Nama Badan Usaha, PT, CV, atau Brand Utama
                </span>
              </label>
              <input
                type="text"
                placeholder="Contoh: PT Kopi Senja Mandiri / Senja Group"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-xs"
                required
              />
            </div>

            {/* Grid 2 Kolom: Nama Toko & No HP/WA Toko (Standard WhatsAppInput) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {/* Input 2: Nama Toko */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-blue-600" />
                    <span>Nama Toko / Outlet Pertama</span>
                    <span className="text-rose-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kopi Senja - Tebet"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-xs"
                  required
                />
                <span className="block mt-1 text-xs text-slate-500 font-medium">
                  Nama gerai fisik tertera di struk kasir
                </span>
              </div>

              {/* Input 3: Nomor WhatsApp Toko (Komponen Resmi Standar Platform) */}
              <div>
                <WhatsAppInput
                  label="Nomor WhatsApp / Hotline Toko"
                  value={phone}
                  onChange={(val) => {
                    setPhone(val);
                    if (error) setError(null);
                  }}
                  placeholder="81234567890"
                  required
                  helperText="Kontak resmi gerai untuk cetak struk kasir"
                />
              </div>
            </div>

            {/* Input 4: Alamat Toko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Alamat Lengkap Toko</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal normal-case text-slate-400">
                  Lokasi operasional gerai fisik
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Jl. Tebet Barat Dalam Raya No. 45, Jakarta Selatan"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all resize-none shadow-xs"
                required
              />
            </div>

            {/* Input 5: Tipe Industri Usaha (Searchable & Multi-Select) */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Tipe Industri Usaha</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {selectedIndustries.length} industri dipilih
                </span>
              </label>

              {/* Selected Pills */}
              {selectedIndustries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 p-2.5 rounded-xl bg-blue-50/60 border border-blue-200">
                  {selectedIndustries.map((ind) => (
                    <span
                      key={ind}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 text-xs font-semibold shadow-2xs"
                    >
                      <span>{ind}</span>
                      <button
                        type="button"
                        onClick={() => removeIndustry(ind)}
                        className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedIndustries([])}
                    className="text-[11px] text-blue-600 hover:text-blue-800 underline self-center ml-2"
                  >
                    Hapus Semua
                  </button>
                </div>
              )}

              {/* Search & Sector Filters */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari jenis usaha (cth: Kedai Kopi, Minimarket, Salon, dll)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sector Tabs */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {(['ALL', 'Ritel', 'Restoran', 'Layanan'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          activeTab === tab
                            ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                      >
                        {tab === 'ALL' ? 'Semua Sektor' : tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Industries Grid */}
                <div className="max-h-52 overflow-y-auto p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                  {filteredIndustries.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 text-xs">
                      Tidak ada industri yang cocok dengan pencarian &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {filteredIndustries.map(({ category, name }) => {
                        const isSelected = selectedIndustries.includes(name);
                        return (
                          <button
                            key={`${category}-${name}`}
                            type="button"
                            onClick={() => toggleIndustry(name)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isSelected
                                ? 'bg-blue-900 border-blue-900 text-white font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                            }`}
                          >
                            <span className={`text-[10px] uppercase tracking-wider font-semibold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              [{category.slice(0, 3)}]
                            </span>
                            <span>{name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer / Submit Area: Proporsional & Elegan */}
            <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 text-center sm:text-left leading-relaxed">
                Toko fisik ini dapat Anda tambahkan toko baru kapan saja dari menu Manajemen Outlet Toko.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-800 active:scale-95 disabled:opacity-50 text-white text-sm font-extrabold rounded-xl shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Membuat Toko...</span>
                  </>
                ) : (
                  <>
                    <span>Buka Dashboard Operasional</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
