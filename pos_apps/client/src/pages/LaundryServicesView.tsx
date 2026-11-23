import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles,
    Plus,
    Search,
    Clock,
    Info,
    Trash2,
    Pencil,
    Power,
    ArrowUpDown,
    ChevronDown,
    Scale,
    Package,
    Layers,
    CheckCircle2,
    AlertCircle,
    Tag,
    Sliders,
    FlaskConical,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryService, ProductionStageDefinition } from '../types/laundry';
import { DEFAULT_PRODUCTION_STAGES } from '../types/laundry';
import { TablePagination } from '../components/TablePagination';
import { LaundryStageSettingsModal } from '../components/LaundryStageSettingsModal';
import { LaundryServiceBomModal } from '../components/laundry/LaundryServiceBomModal';

interface LaundryServicesViewProps {
    activeOutlet: Outlet | null;
}

type SortOption = 'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME_ASC' | 'DURATION_ASC';

const DEFAULT_LAUNDRY_SERVICES: LaundryService[] = [
    {
        id: 'ls-01',
        name: 'Cuci Komplit Reguler (Cuci + Kering + Setrika)',
        category: 'KILOAN',
        price: 8000,
        unit: 'Kg',
        minOrderQty: 3,
        durationHours: 48,
        expressMultiplier: 1.0,
        description: 'Pencucian higienis dengan deterjen premium, pengeringan mesin, dan setrika uap rapi bergaransi.',
        isActive: true,
    },
    {
        id: 'ls-02',
        name: 'Cuci Kering Lipat',
        category: 'KILOAN',
        price: 6000,
        unit: 'Kg',
        minOrderQty: 3,
        durationHours: 36,
        expressMultiplier: 1.0,
        description: 'Pencucian higienis dan pengeringan mesin, dilipat rapi tanpa setrika.',
        isActive: true,
    },
    {
        id: 'ls-03',
        name: 'Setrika Uap Saja',
        category: 'KILOAN',
        price: 5000,
        unit: 'Kg',
        minOrderQty: 2,
        durationHours: 24,
        expressMultiplier: 1.0,
        description: 'Setrika uap boiler halus dan rapi untuk pakaian yang sudah bersih.',
        isActive: true,
    },
    {
        id: 'ls-04',
        name: 'Paket Kilat 12 Jam (Express)',
        category: 'EXPRESS',
        price: 15000,
        unit: 'Kg',
        minOrderQty: 3,
        durationHours: 12,
        expressMultiplier: 1.0,
        description: 'Prioritas workshop: selesai dan siap diambil maksimal dalam 12 jam sejak pakaian masuk.',
        isActive: true,
    },
    {
        id: 'ls-05',
        name: 'Jas & Blazer (Dry Clean)',
        category: 'SATUAN',
        price: 35000,
        unit: 'Pcs',
        minOrderQty: 1,
        durationHours: 48,
        expressMultiplier: 1.0,
        description: 'Dry cleaning profesional menjaga serat wol dan struktur bahu jas tetap presisi.',
        isActive: true,
    },
    {
        id: 'ls-06',
        name: 'Bedcover Jumbo / King Size',
        category: 'SATUAN',
        price: 30000,
        unit: 'Pcs',
        minOrderQty: 1,
        durationHours: 48,
        expressMultiplier: 1.0,
        description: 'Pencucian mendalam tabung besar, serat dakron mengembang kembali, wangi tahan lama.',
        isActive: true,
    },
    {
        id: 'ls-07',
        name: 'Sepatu Sneaker / Canvas (Deep Clean)',
        category: 'SEPATU_TAS',
        price: 30000,
        unit: 'Pasang',
        minOrderQty: 1,
        durationHours: 72,
        expressMultiplier: 1.0,
        description: 'Pembersihan sol, upper, midsole, dan insole menggunakan cleaner khusus tanpa merusak lem.',
        isActive: true,
    },
    {
        id: 'ls-08',
        name: 'Cuci Karpet Tebal (Per Meter Persegi)',
        category: 'KARPET_GORDEN',
        price: 20000,
        unit: 'm²',
        minOrderQty: 2,
        durationHours: 72,
        expressMultiplier: 1.0,
        description: 'Pencucian karpet dengan mesin sikat rotary dan ekstraktor air bertekanan tinggi.',
        isActive: true,
    },
    // Add-ons Standar
    {
        id: 'ls-addon-01',
        name: 'Hilangkan Noda Membandel (Spotting)',
        category: 'ADDON',
        price: 10000,
        unit: 'FLAT',
        minOrderQty: 1,
        durationHours: 0,
        expressMultiplier: 1.0,
        description: 'Treatment cairan khusus untuk noda darah, getah, tinta, karat, atau jamur.',
        isActive: true,
    },
    {
        id: 'ls-addon-02',
        name: 'Parfum Sultan Premium (Grade A)',
        category: 'ADDON',
        price: 2500,
        unit: 'PER_KG',
        minOrderQty: 1,
        durationHours: 0,
        expressMultiplier: 1.0,
        description: 'Parfum microcapsule mewah wangi tahan lama hingga 14 hari.',
        isActive: true,
    },
    {
        id: 'ls-addon-03',
        name: 'Anti-Bakteri & Sanitasi Higienis',
        category: 'ADDON',
        price: 2000,
        unit: 'PER_KG',
        minOrderQty: 1,
        durationHours: 0,
        expressMultiplier: 1.0,
        description: 'Sanitasi disinfektan higienis membunuh 99.9% kuman dan tungau pakaian.',
        isActive: true,
    },
    {
        id: 'ls-addon-04',
        name: 'Hanger Jas & Plastik Pelindung',
        category: 'ADDON',
        price: 3500,
        unit: 'FLAT',
        minOrderQty: 1,
        durationHours: 0,
        expressMultiplier: 1.0,
        description: 'Gantungan baju kokoh dan kantong plastik pelindung debu.',
        isActive: true,
    },
];

const STANDARD_UNITS = [
    { value: 'Kg', label: 'Kg (Kiloan)', icon: Scale },
    { value: 'Pcs', label: 'Pcs (Satuan)', icon: Package },
    { value: 'Pasang', label: 'Pasang (Sepatu)', icon: Package },
    { value: 'Set', label: 'Set (Bedset/Jas)', icon: Layers },
    { value: 'm²', label: 'm² (Karpet/Gorden)', icon: Layers },
];

export const LaundryServicesView: React.FC<LaundryServicesViewProps> = ({ activeOutlet }) => {
    const [services, setServices] = useState<LaundryService[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab Utama: Layanan Utama vs Layanan Tambahan (Add-ons)
    const [activeMainTab, setActiveMainTab] = useState<'SERVICES' | 'ADDONS'>('SERVICES');

    // Filter & Search Layanan Utama
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

    // Modal State (Tambah / Edit)
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState<LaundryService | null>(null);

    // Form State (Layanan Utama & Addon)
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState<string>('KILOAN');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [formPrice, setFormPrice] = useState('8000');
    const [formUnit, setFormUnit] = useState('Kg');
    const [formHasMinOrder, setFormHasMinOrder] = useState(true);
    const [formMinOrder, setFormMinOrder] = useState('3');
    const [formDuration, setFormDuration] = useState('48');
    const [formDescription, setFormDescription] = useState('');
    const [formStages, setFormStages] = useState<string[]>([
        'LABEL',
        'SORTIR',
        'CUCI',
        'KERING',
        'SETRIKA',
        'LIPAT',
        'PENGEMASAN',
    ]);
    const [formIsActive, setFormIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal Setting Tahapan Toko
    const [showStageSettingsModal, setShowStageSettingsModal] = useState(false);
    const [storeStages, setStoreStages] = useState<ProductionStageDefinition[]>(DEFAULT_PRODUCTION_STAGES);

    // Modal BoM (Takaran Bahan Cuci)
    const [selectedBomService, setSelectedBomService] = useState<LaundryService | null>(null);
    const [showBomModal, setShowBomModal] = useState(false);

    const handleOpenBomModal = (service: LaundryService) => {
        setSelectedBomService(service);
        setShowBomModal(true);
    };

    // Toast feedback
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3500);
    };

    const fetchServices = async () => {
        try {
            setLoading(true);
            const [res, stagesRes] = await Promise.all([
                api.getLaundryServices(),
                api.getLaundryStageSettings ? api.getLaundryStageSettings().catch(() => null) : Promise.resolve(null),
            ]);

            if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                setServices(res.data);
            } else {
                setServices(DEFAULT_LAUNDRY_SERVICES);
            }

            if (stagesRes && stagesRes.status === 'success' && Array.isArray(stagesRes.data)) {
                setStoreStages(stagesRes.data);
            }
        } catch {
            setServices(DEFAULT_LAUNDRY_SERVICES);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, [activeOutlet?.id]);

    // Pisahkan Layanan Utama vs Add-ons
    const mainServices = useMemo(() => {
        return services.filter((s) => s.category?.toUpperCase() !== 'ADDON');
    }, [services]);

    const addonServices = useMemo(() => {
        return services.filter((s) => s.category?.toUpperCase() === 'ADDON');
    }, [services]);

    // Buka Modal Tambah Baru (Layanan Utama)
    const handleOpenAddService = () => {
        setEditingService(null);
        setFormName('');
        setFormCategory('KILOAN');
        setIsCustomCategory(false);
        setFormPrice('8000');
        setFormUnit('Kg');
        setFormHasMinOrder(true);
        setFormMinOrder('3');
        setFormDuration('48');
        setFormDescription('');
        setFormStages([
            'LABEL',
            'SORTIR',
            'CUCI',
            'KERING',
            'SETRIKA',
            'LIPAT',
            'PENGEMASAN',
        ]);
        setFormIsActive(true);
        setShowModal(true);
    };

    // Buka Modal Tambah Add-on Baru
    const handleOpenAddAddon = () => {
        setEditingService(null);
        setFormName('');
        setFormCategory('ADDON');
        setIsCustomCategory(false);
        setFormPrice('5000');
        setFormUnit('FLAT');
        setFormHasMinOrder(false);
        setFormMinOrder('1');
        setFormDuration('0');
        setFormDescription('');
        setFormStages([]);
        setFormIsActive(true);
        setShowModal(true);
    };

    // Buka Modal Edit Layanan
    const handleOpenEdit = (srv: LaundryService) => {
        setEditingService(srv);
        setFormName(srv.name);
        const catUpper = srv.category?.toUpperCase() || 'KILOAN';
        const isStandardCat = ['KILOAN', 'SATUAN', 'EXPRESS', 'SEPATU_TAS', 'KARPET_GORDEN', 'STROLLER', 'ADDON'].includes(catUpper);
        setFormCategory(srv.category);
        setIsCustomCategory(!isStandardCat);
        setFormPrice(String(srv.price || 0));
        setFormUnit(srv.unit || 'Kg');
        const minQtyVal = Number(srv.minOrderQty);
        const hasMin = minQtyVal > 1;
        setFormHasMinOrder(hasMin);
        setFormMinOrder(hasMin ? String(minQtyVal) : '3');
        setFormDuration(String(srv.durationHours || 0));
        setFormDescription(srv.description || '');
        if (Array.isArray(srv.stages) && srv.stages.length > 0) {
            setFormStages(srv.stages);
        } else {
            const lower = srv.name.toLowerCase();
            if (lower.includes('lipat')) {
                setFormStages(['LABEL', 'SORTIR', 'CUCI', 'KERING', 'LIPAT', 'PENGEMASAN']);
            } else if (lower.includes('setrika saja')) {
                setFormStages(['SORTIR', 'SETRIKA', 'PENGEMASAN']);
            } else if (srv.category === 'SEPATU_TAS' || lower.includes('sepatu') || lower.includes('tas')) {
                setFormStages(['LABEL', 'SORTIR', 'CLEANING', 'DETAILING', 'KERING', 'PENGEMASAN']);
            } else {
                setFormStages(['LABEL', 'SORTIR', 'CUCI', 'KERING', 'SETRIKA', 'LIPAT', 'PENGEMASAN']);
            }
        }
        setFormIsActive(srv.isActive);
        setShowModal(true);
    };

    // Simpan Layanan (Create / Update)
    const handleSaveService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            showToast('Nama wajib diisi', 'error');
            return;
        }

        try {
            setSaving(true);
            const isAddon = formCategory === 'ADDON';
            const payload = {
                name: formName.trim(),
                category: formCategory.trim() || (isAddon ? 'ADDON' : 'KILOAN'),
                unit: formUnit.trim(),
                price: parseFloat(formPrice) || 0,
                minOrderQty: isAddon ? 1 : formHasMinOrder ? parseFloat(formMinOrder) || 1 : 0,
                durationHours: isAddon ? 0 : parseInt(formDuration, 10) || 48,
                expressMultiplier: 1.0,
                description: formDescription.trim() || undefined,
                stages: isAddon ? [] : formStages,
                isActive: formIsActive,
            };

            if (editingService) {
                const res = await api.updateLaundryService(editingService.id, payload);
                if (res.status === 'success') {
                    showToast(`"${formName}" berhasil diperbarui!`);
                    setShowModal(false);
                    await fetchServices();
                } else {
                    showToast(res.message || 'Gagal memperbarui data', 'error');
                }
            } else {
                const res = await api.createLaundryService(payload);
                if (res.status === 'success') {
                    showToast(`"${formName}" berhasil ditambahkan!`);
                    setShowModal(false);
                    await fetchServices();
                } else {
                    showToast(res.message || 'Gagal menambahkan data', 'error');
                }
            }
        } catch (err: any) {
            showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Quick Toggle Status Aktif / Nonaktif
    const handleToggleActive = async (service: LaundryService) => {
        try {
            const nextState = !service.isActive;
            const res = await api.updateLaundryService(service.id, { isActive: nextState });
            if (res.status === 'success') {
                setServices((prev) =>
                    prev.map((s) => (s.id === service.id ? { ...s, isActive: nextState } : s))
                );
                showToast(`"${service.name}" ${nextState ? 'diaktifkan' : 'dinonaktifkan'}`);
            } else {
                showToast(res.message || 'Gagal mengubah status', 'error');
            }
        } catch {
            showToast('Terjadi kesalahan saat mengubah status layanan', 'error');
        }
    };

    // Hapus / Nonaktifkan Permanen
    const handleDeleteService = async (id: string, name: string) => {
        if (!window.confirm(`Yakin ingin menonaktifkan "${name}"? Data tidak akan muncul di kasir.`)) return;
        try {
            await api.deleteLaundryService(id);
            showToast(`"${name}" telah dinonaktifkan`);
            fetchServices();
        } catch {
            showToast('Gagal menonaktifkan item', 'error');
        }
    };

    // Kategori Dinamis diekstrak dari Layanan Utama
    const dynamicCategories = useMemo(() => {
        const raw = mainServices.map((s) => s.category?.toUpperCase()).filter(Boolean);
        const unique = Array.from(new Set(raw));
        return ['ALL', ...unique];
    }, [mainServices]);

    const getCategoryBadgeLabel = (cat: string) => {
        switch (cat) {
            case 'ALL':
                return 'Semua';
            case 'KILOAN':
                return '🧺 Kiloan';
            case 'BEDDING':
                return '🛏️ Bedding & Selimut';
            case 'PAKAIAN_SATUAN':
                return '👔 Pakaian Satuan';
            case 'SATUAN':
                return '👔 Satuan / Dry Clean';
            case 'EXPRESS':
                return '⚡ Express';
            case 'SEPATU_TAS':
                return '👟 Sepatu & Tas';
            case 'BONEKA_BABY':
                return '🍼 Boneka & Baby Gear';
            case 'KARPET_GORDEN':
                return '🏠 Karpet & Gorden';
            case 'STROLLER':
                return '🍼 Stroller & Baby Gear';
            default:
                return `🏷️ ${cat.replace(/_/g, ' ')}`;
        }
    };

    // Filter & Pengurutan Layanan Utama
    const filteredAndSortedServices = useMemo(() => {
        let result = mainServices.filter((s) => {
            if (activeCategory !== 'ALL' && s.category?.toUpperCase() !== activeCategory.toUpperCase()) {
                return false;
            }
            if (statusFilter === 'ACTIVE' && !s.isActive) return false;
            if (statusFilter === 'INACTIVE' && s.isActive) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = s.name.toLowerCase().includes(q);
                const matchDesc = s.description && s.description.toLowerCase().includes(q);
                const matchCat = s.category.toLowerCase().includes(q);
                return matchName || matchDesc || matchCat;
            }
            return true;
        });

        result = [...result].sort((a, b) => {
            if (sortBy === 'PRICE_ASC') return Number(a.price) - Number(b.price);
            if (sortBy === 'PRICE_DESC') return Number(b.price) - Number(a.price);
            if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
            if (sortBy === 'DURATION_ASC') return Number(a.durationHours) - Number(b.durationHours);
            return 0;
        });

        return result;
    }, [mainServices, activeCategory, statusFilter, searchQuery, sortBy]);

    // Pagination State (Kanonikal TablePagination - Rule #7)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeCategory, statusFilter, searchQuery, sortBy]);

    const totalServices = filteredAndSortedServices.length;
    const totalPages = Math.max(1, Math.ceil(totalServices / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedServices = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return filteredAndSortedServices.slice(start, start + pageSize);
    }, [filteredAndSortedServices, safeCurrentPage, pageSize]);

    // Filter Add-ons
    const filteredAddons = useMemo(() => {
        return addonServices.filter((a) => {
            if (statusFilter === 'ACTIVE' && !a.isActive) return false;
            if (statusFilter === 'INACTIVE' && a.isActive) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return a.name.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q));
            }
            return true;
        });
    }, [addonServices, statusFilter, searchQuery]);

    return (
        <div className="space-y-6 pb-28 sm:pb-16 font-sans animate-fadeIn text-slate-800">
            {/* 1. Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
                        <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                            <Sparkles className="w-4 h-4 shrink-0" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                            Katalog Layanan, Tarif &amp; Treatment Laundry
                        </h2>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                            {activeOutlet?.name || 'Toko Aktif'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                        Kelola katalog tarif kiloan, satuan (dry clean, sepatu, karpet m²), durasi pengerjaan, serta opsi perlakuan khusus (*Spotting, Parfum Sultan, Anti-Bakteri*).
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                    {activeMainTab === 'SERVICES' ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setShowStageSettingsModal(true)}
                                className="w-full sm:w-auto h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm border border-slate-300 shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                                title="Atur tahapan produksi toko (11 preset standar SmartOwner atau kustom)"
                            >
                                <Sliders className="w-4 h-4 text-slate-600" />
                                <span>Atur Tahapan Produksi</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenAddService}
                                className="w-full sm:w-auto h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Tambah Layanan Baru</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleOpenAddAddon}
                            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Tambah Add-on / Treatment</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Top Navigation Tabs: Layanan Utama vs Layanan Tambahan (Add-ons) */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl w-full sm:w-fit">
                <button
                    type="button"
                    onClick={() => {
                        setActiveMainTab('SERVICES');
                        setSearchQuery('');
                    }}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${activeMainTab === 'SERVICES'
                        ? 'bg-white text-blue-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Katalog Layanan Utama ({mainServices.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setActiveMainTab('ADDONS');
                        setSearchQuery('');
                    }}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${activeMainTab === 'ADDONS'
                        ? 'bg-white text-purple-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Tag className="w-4 h-4 text-purple-600" />
                    <span>Layanan Tambahan &amp; Treatment ({addonServices.length})</span>
                </button>
            </div>

            {/* 3. WORKSPACE KONTEN UTAMA */}
            {activeMainTab === 'SERVICES' ? (
                /* ================= TAB 1: LAYANAN UTAMA ================= */
                <div className="space-y-4">
                    {/* Toolbar Filter & Sorting */}
                    <div className="space-y-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
                        {/* Baris Atas: Tab Kategori Dinamis */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {dynamicCategories.map((cat: string) => {
                                const count =
                                    cat === 'ALL'
                                        ? mainServices.length
                                        : mainServices.filter((s) => s.category?.toUpperCase() === cat.toUpperCase()).length;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${activeCategory === cat
                                            ? 'bg-blue-900 text-white shadow-xs'
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                    >
                                        {getCategoryBadgeLabel(cat)} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Baris Bawah: Search, Status & Sorting */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari nama layanan, kategori, atau deskripsi..."
                                    className="w-full h-9 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-900 transition-all font-medium"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as any)}
                                        className="h-9 px-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-900 appearance-none"
                                    >
                                        <option value="ALL">Semua Status</option>
                                        <option value="ACTIVE">Hanya Aktif</option>
                                        <option value="INACTIVE">Hanya Nonaktif</option>
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                                </div>

                                <div className="relative flex items-center">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="h-9 pl-8 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-900 appearance-none"
                                    >
                                        <option value="DEFAULT">Urutan Standar</option>
                                        <option value="PRICE_ASC">Tarif: Termurah</option>
                                        <option value="PRICE_DESC">Tarif: Termahal</option>
                                        <option value="NAME_ASC">Nama: A - Z</option>
                                        <option value="DURATION_ASC">Durasi: Tercepat</option>
                                    </select>
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid Layanan Utama */}
                    {loading ? (
                        <div className="p-16 text-center text-slate-400 text-xs font-semibold animate-pulse">
                            Memuat katalog layanan laundry...
                        </div>
                    ) : filteredAndSortedServices.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs space-y-2">
                            <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                            <p className="font-bold text-slate-700">Tidak ada layanan yang sesuai</p>
                            <p className="text-[11px] text-slate-400">Silakan ubah filter pencarian atau buat layanan baru.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedServices.map((service) => {
                                    const isKiloan = service.category?.toUpperCase() === 'KILOAN';
                                    const isExpress = service.category?.toUpperCase() === 'EXPRESS';
                                    const isSepatu = service.category?.toUpperCase() === 'SEPATU_TAS';

                                    return (
                                        <div
                                            key={service.id}
                                            className={`bg-white rounded-3xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${service.isActive ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/50 opacity-75'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-2.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span
                                                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${isExpress
                                                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                                                : isKiloan
                                                                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                                                                    : isSepatu
                                                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                                        : 'bg-purple-50 text-purple-900 border-purple-200'
                                                                }`}
                                                        >
                                                            {service.category}
                                                        </span>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                            Harga per: {service.unit}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleActive(service)}
                                                            className={`p-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${service.isActive
                                                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                                                : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                                                                }`}
                                                            title={service.isActive ? 'Layanan Aktif (Klik untuk nonaktifkan)' : 'Layanan Nonaktif (Klik untuk aktifkan)'}
                                                        >
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(service)}
                                                            className="p-1 rounded-lg text-slate-500 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                                                            title="Edit Layanan & Tarif"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteService(service.id, service.name)}
                                                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                            title="Hapus / Nonaktifkan"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <h3 className="font-extrabold text-slate-900 text-sm leading-snug mb-1 group-hover:text-blue-900 transition-colors">
                                                    {service.name}
                                                </h3>
                                                {service.description ? (
                                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                                        {service.description}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic mb-3">Tidak ada catatan deskripsi.</p>
                                                )}
                                            </div>

                                            <div className="pt-3 border-t border-slate-100 space-y-2">
                                                <div className="flex items-baseline justify-between">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            Tarif Dasar
                                                        </div>
                                                        <div className="text-base font-black text-slate-900">
                                                            Rp {Number(service.price).toLocaleString('id-ID')}
                                                            <span className="text-xs font-semibold text-slate-500"> / {service.unit}</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            Estimasi Durasi
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            <span>{service.durationHours} Jam</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {Number(service.minOrderQty) > 1 && (
                                                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-50/80 p-1.5 rounded-xl flex items-center gap-1.5 border border-amber-200">
                                                        <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                                        <span>
                                                            Min. order: <b>{Number(service.minOrderQty)} {service.unit}</b> (di bawah itu kena tarif minimum)
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Badge Tahapan Produksi */}
                                                {Array.isArray(service.stages) && service.stages.length > 0 && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-900 bg-blue-50/80 px-2.5 py-1.5 rounded-xl border border-blue-200">
                                                        <Layers className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                                        <span className="truncate">
                                                            {service.stages.length} Tahap: {service.stages.slice(0, 4).map(s => {
                                                                const found = storeStages.find(st => (st.key === s || st.id === s));
                                                                return found ? found.name : s;
                                                            }).join(' → ')}{service.stages.length > 4 ? ` +${service.stages.length - 4}` : ''}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Badge & Tombol Takaran Bahan (BoM) */}
                                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <FlaskConical className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                                                        {service.bomItemsCount && service.bomItemsCount > 0 ? (
                                                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 truncate">
                                                                {service.bomItemsCount} Bahan (HPP: Rp {service.estimatedBomCost?.toLocaleString('id-ID')})
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                                                Belum Ada BoM
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenBomModal(service)}
                                                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                                        title="Atur takaran bahan cuci otomatis (BoM)"
                                                    >
                                                        <span>Takaran BoM</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* TablePagination Kanonikal Sesuai Aturan Sistem */}
                            {totalServices > 0 && (
                                <div className="pt-2">
                                    <TablePagination
                                        currentPage={safeCurrentPage}
                                        pageSize={pageSize}
                                        totalItems={totalServices}
                                        onPageChange={setCurrentPage}
                                        onPageSizeChange={setPageSize}
                                        pageSizeOptions={[10, 25, 50, 100]}
                                        itemLabel="layanan"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* ================= TAB 2: LAYANAN TAMBAHAN (ADD-ONS) ================= */
                <div className="space-y-4">
                    {/* Banner Penjelasan Add-on */}
                    <div className="p-4 rounded-3xl bg-purple-50/80 border border-purple-200 text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-purple-900 text-white flex items-center justify-center font-bold shrink-0">
                                <Tag className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm">Perlakuan Khusus &amp; Layanan Tambahan (Add-ons)</h4>
                                <p className="text-[11px] text-purple-800 leading-relaxed">
                                    Add-on dapat dicentang oleh kasir saat menerima pakaian pelanggan (misal: noda getah/darah, parfum sultan 14 hari, hanger jas).
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenAddAddon}
                            className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Tambah Add-on</span>
                        </button>
                    </div>

                    {/* Grid Add-ons */}
                    {loading ? (
                        <div className="p-16 text-center text-slate-400 text-xs font-semibold animate-pulse">
                            Memuat daftar add-on...
                        </div>
                    ) : filteredAddons.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs space-y-2">
                            <Tag className="w-8 h-8 mx-auto text-slate-300" />
                            <p className="font-bold text-slate-700">Belum ada add-on treatment terdaftar</p>
                            <button
                                type="button"
                                onClick={handleOpenAddAddon}
                                className="px-4 py-1.5 rounded-xl bg-purple-900 text-white font-bold text-xs"
                            >
                                + Buat Add-on Pertama
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAddons.map((addon) => {
                                const isPerKg = ['PER_KG', 'PER_UNIT', 'KG'].includes((addon.unit || '').toUpperCase());

                                return (
                                    <div
                                        key={addon.id}
                                        className={`bg-white rounded-3xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${addon.isActive ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/50 opacity-75'
                                            }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span
                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${isPerKg
                                                        ? 'bg-blue-50 text-blue-900 border-blue-200'
                                                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                        }`}
                                                >
                                                    {isPerKg ? 'Per Kuantitas / Kg' : 'Biaya Tetap (Flat)'}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleActive(addon)}
                                                        className={`p-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${addon.isActive
                                                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                                            : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                                                            }`}
                                                        title={addon.isActive ? 'Add-on Aktif' : 'Add-on Nonaktif'}
                                                    >
                                                        <Power className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(addon)}
                                                        className="p-1 rounded-lg text-slate-500 hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer"
                                                        title="Edit Add-on"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteService(addon.id, addon.name)}
                                                        className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Hapus Add-on"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <h3 className="font-extrabold text-slate-900 text-sm leading-snug mb-1 group-hover:text-purple-900 transition-colors">
                                                {addon.name}
                                            </h3>
                                            {addon.description && (
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                                    {addon.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Tarif Tambahan
                                                </div>
                                                <div className="text-base font-black text-purple-950">
                                                    +Rp {Number(addon.price).toLocaleString('id-ID')}
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        {' '}
                                                        {isPerKg ? '/ Kg' : '/ Item'}
                                                    </span>
                                                </div>
                                            </div>

                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                {isPerKg ? 'Dihitung x Berat' : 'Tarif Pasti'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 4. MODAL FORM TAMBAH / EDIT (LAYANAN UTAMA & ADD-ON) */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div
                                    className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold shadow-xs ${formCategory === 'ADDON' ? 'bg-purple-900' : 'bg-blue-900'
                                        }`}
                                >
                                    {formCategory === 'ADDON' ? <Tag className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm">
                                        {formCategory === 'ADDON'
                                            ? editingService
                                                ? 'Edit Add-on Treatment'
                                                : 'Tambah Add-on / Perlakuan Khusus'
                                            : editingService
                                                ? 'Edit Layanan & Tarif'
                                                : 'Tambah Layanan Laundry Baru'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {formCategory === 'ADDON'
                                            ? 'Biaya tambahan perlakuan noda, parfum grade A, atau packaging'
                                            : 'Konfigurasi tarif dasar, minimal order, dan durasi SLA'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Form Scrollable Body */}
                        <form onSubmit={handleSaveService} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 text-xs">
                                {/* 1. Nama Item */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {formCategory === 'ADDON' ? 'Nama Add-on / Treatment' : 'Nama Layanan'}{' '}
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder={
                                            formCategory === 'ADDON'
                                                ? 'Contoh: Hilangkan Noda Darah/Getah, Parfum Sultan, Anti-Bakteri...'
                                                : 'Contoh: Cuci Komplit Wangi, Dry Clean Jas, Karpet Tebal...'
                                        }
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white"
                                    />
                                </div>

                                {/* 2. Kategori Layanan (Jika bukan Add-on) */}
                                {formCategory !== 'ADDON' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-slate-700">
                                                Kategori Layanan <span className="text-rose-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextState = !isCustomCategory;
                                                    setIsCustomCategory(nextState);
                                                    setFormCategory(nextState ? '' : 'KILOAN');
                                                }}
                                                className="text-[10px] text-blue-800 hover:text-blue-950 font-bold cursor-pointer"
                                            >
                                                {isCustomCategory ? '← Pilih dari Standar' : '+ Buat Kategori Kustom'}
                                            </button>
                                        </div>

                                        {isCustomCategory ? (
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ketik kategori kustom (cth: Stroller, Gorden, Boneka, Helm)..."
                                                value={formCategory}
                                                onChange={(e) => setFormCategory(e.target.value)}
                                                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white"
                                            />
                                        ) : (
                                            <div className="relative">
                                                <select
                                                    value={formCategory}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFormCategory(val);
                                                        if (val === 'KILOAN') {
                                                            setFormUnit('Kg');
                                                            setFormHasMinOrder(true);
                                                            setFormMinOrder('3');
                                                        } else if (val === 'SEPATU_TAS') {
                                                            setFormUnit('Pasang');
                                                            setFormHasMinOrder(false);
                                                            setFormMinOrder('1');
                                                        } else if (val === 'KARPET_GORDEN') {
                                                            setFormUnit('m²');
                                                            setFormHasMinOrder(true);
                                                            setFormMinOrder('2');
                                                        } else {
                                                            setFormUnit('Pcs');
                                                            setFormHasMinOrder(false);
                                                            setFormMinOrder('1');
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 pr-10 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none appearance-none"
                                                >
                                                    <option value="KILOAN">🧺 Cuci Kiloan</option>
                                                    <option value="SATUAN">👔 Satuan / Dry Clean</option>
                                                    <option value="EXPRESS">⚡ Kilat / Express</option>
                                                    <option value="SEPATU_TAS">👟 Sepatu &amp; Tas</option>
                                                    <option value="KARPET_GORDEN">🏠 Karpet &amp; Gorden (m²)</option>
                                                    <option value="STROLLER">🍼 Stroller &amp; Perlengkapan Bayi</option>
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 3. Khusus ADD-ON: Tipe Perhitungan Biaya */}
                                {formCategory === 'ADDON' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Skema Perhitungan Biaya Add-on <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormUnit('FLAT')}
                                                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${formUnit === 'FLAT'
                                                    ? 'bg-purple-900 border-purple-900 text-white shadow-xs'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <div className="font-bold text-xs">Biaya Tetap (Flat)</div>
                                                <div className="text-[10px] opacity-80 mt-0.5">Dikenakan 1x per cucian/item</div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormUnit('PER_KG')}
                                                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${formUnit === 'PER_KG'
                                                    ? 'bg-purple-900 border-purple-900 text-white shadow-xs'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <div className="font-bold text-xs">Per Kuantitas / Kg</div>
                                                <div className="text-[10px] opacity-80 mt-0.5">Dikalikan berat cucian (Rp x Kg)</div>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Khusus LAYANAN UTAMA: Harga per & Batas Minimum Order */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Harga per <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Kg, Pcs, Pasang, m², Set"
                                                value={formUnit}
                                                onChange={(e) => setFormUnit(e.target.value)}
                                                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white"
                                            />
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                {STANDARD_UNITS.map((u) => (
                                                    <button
                                                        key={u.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormUnit(u.value);
                                                            if (u.value === 'Kg' && formHasMinOrder && formMinOrder === '1') setFormMinOrder('3');
                                                        }}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${formUnit.toLowerCase() === u.value.toLowerCase()
                                                            ? 'bg-blue-900 text-white border-blue-900'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                                                            }`}
                                                    >
                                                        {u.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-bold text-slate-700">
                                                    Batas Minimal Order
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = !formHasMinOrder;
                                                        setFormHasMinOrder(next);
                                                        if (next && (!formMinOrder || Number(formMinOrder) <= 1)) {
                                                            setFormMinOrder(formUnit === 'Kg' ? '3' : '2');
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${formHasMinOrder
                                                        ? 'bg-blue-900 text-white shadow-2xs'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                                        }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${formHasMinOrder ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                                                    <span>{formHasMinOrder ? 'Aktif' : 'Nonaktif'}</span>
                                                </button>
                                            </div>

                                            {formHasMinOrder ? (
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0.1"
                                                            required
                                                            value={formMinOrder}
                                                            onChange={(e) => setFormMinOrder(e.target.value)}
                                                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white"
                                                            placeholder="3"
                                                        />
                                                        <span className="text-xs font-bold text-slate-600 shrink-0">{formUnit}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                                        Pesanan &lt; {formMinOrder || 1} {formUnit} dikenakan tarif minimum {formMinOrder || 1} {formUnit}.
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 font-medium">
                                                    Batas minimal nonaktif (dihitung murni sesuai timbangan/kuantitas aktual).
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 4. Tarif (Rp) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {formCategory === 'ADDON' ? 'Besaran Biaya Tambahan (Rp)' : 'Tarif Dasar (Rp)'}{' '}
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="500"
                                        value={formPrice}
                                        onChange={(e) => setFormPrice(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white text-slate-900"
                                    />
                                    <span className="text-[10px] text-slate-500 mt-1 block font-semibold">
                                        {formCategory === 'ADDON'
                                            ? formUnit === 'PER_KG'
                                                ? `+Rp ${Number(formPrice || 0).toLocaleString('id-ID')} / Kg cucian`
                                                : `+Rp ${Number(formPrice || 0).toLocaleString('id-ID')} flat per cucian`
                                            : `Rp ${Number(formPrice || 0).toLocaleString('id-ID')} / ${formUnit}`}
                                    </span>
                                </div>

                                {/* 5. Khusus LAYANAN UTAMA: Durasi Pengerjaan */}
                                {formCategory !== 'ADDON' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Estimasi Durasi Pengerjaan (Jam) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formDuration}
                                            onChange={(e) => setFormDuration(e.target.value)}
                                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white"
                                        />
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            {[
                                                { hours: 6, label: '6 Jam (Kilat)' },
                                                { hours: 12, label: '12 Jam' },
                                                { hours: 24, label: '1 Hari' },
                                                { hours: 48, label: '2 Hari' },
                                                { hours: 72, label: '3 Hari' },
                                            ].map((preset) => (
                                                <button
                                                    key={preset.hours}
                                                    type="button"
                                                    onClick={() => setFormDuration(String(preset.hours))}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${formDuration === String(preset.hours)
                                                        ? 'bg-blue-900 text-white border-blue-900'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                                        }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 6. Tahapan Pengerjaan Layanan (SOP Produksi) */}
                                {formCategory !== 'ADDON' && (
                                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-800">
                                                    Tahapan Pengerjaan Layanan (SOP Produksi)
                                                </label>
                                                <span className="text-[10px] text-slate-500">
                                                    Pilih tahapan mesin & pengerjaan yang wajib dilalui cucian pada layanan ini.
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                                                {formStages.length} Tahap Terpilih
                                            </span>
                                        </div>

                                        {/* Quick Presets */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Preset Cepat:</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormStages([
                                                        'LABEL',
                                                        'SORTIR',
                                                        'CUCI',
                                                        'KERING',
                                                        'SETRIKA',
                                                        'LIPAT',
                                                        'PENGEMASAN',
                                                    ])
                                                }
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
                                            >
                                                ⚡ Cuci Komplit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormStages([
                                                        'LABEL',
                                                        'SORTIR',
                                                        'CUCI',
                                                        'KERING',
                                                        'LIPAT',
                                                        'PENGEMASAN',
                                                    ])
                                                }
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
                                            >
                                                👕 Cuci Lipat
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormStages(['SORTIR', 'SETRIKA', 'PENGEMASAN'])}
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
                                            >
                                                🔥 Setrika Saja
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormStages([
                                                        'LABEL',
                                                        'SORTIR',
                                                        'CLEANING',
                                                        'DETAILING',
                                                        'KERING',
                                                        'PENGEMASAN',
                                                    ])
                                                }
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
                                            >
                                                👟 Sepatu &amp; Tas
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormStages(
                                                        storeStages.filter((s) => s.isActive).map((s) => s.key || s.id || '')
                                                    )
                                                }
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
                                            >
                                                Pilih Semua
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormStages([])}
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        {/* Grid Checkbox Tahapan Aktif */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto overscroll-contain">
                                            {storeStages
                                                .filter((s) => s.isActive)
                                                .map((stage) => {
                                                    const stageKey = stage.key || stage.id || '';
                                                    const isChecked = formStages.includes(stageKey);
                                                    const stageIndex = formStages.indexOf(stageKey);

                                                    return (
                                                        <label
                                                            key={stageKey}
                                                            className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isChecked
                                                                ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-2xs'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFormStages((prev) => [...prev, stageKey]);
                                                                    } else {
                                                                        setFormStages((prev) => prev.filter((k) => k !== stageKey));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-900 cursor-pointer"
                                                            />
                                                            <div className="min-w-0 flex-1 flex items-center justify-between">
                                                                <span className="truncate">{stage.name}</span>
                                                                {isChecked && (
                                                                    <span className="text-[9px] w-4 h-4 rounded-full bg-blue-900 text-white flex items-center justify-center font-black shrink-0">
                                                                        {stageIndex + 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* 7. Deskripsi Item */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Deskripsi / Catatan Perlakuan
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder={
                                            formCategory === 'ADDON'
                                                ? 'Contoh: Menggunakan cairan spotting khusus noda membandel tanpa merusak serat...'
                                                : 'Contoh: Pencucian tabung khusus, deterjen anti-bakteri, setrika uap rapi...'
                                        }
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white font-medium"
                                    />
                                </div>

                                {/* 7. Status Aktif Toggle */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 block">Status Aktif</span>
                                        <span className="text-[10px] text-slate-500">
                                            Item aktif akan langsung muncul di katalog kasir
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={formIsActive}
                                        onChange={(e) => setFormIsActive(e.target.checked)}
                                        className="w-5 h-5 text-blue-900 rounded border-slate-300 focus:ring-blue-900 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Modal Sticky Footer (Kanonikal PWA & Safe Area) */}
                            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-200 transition-all text-xs cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`px-6 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${formCategory === 'ADDON'
                                        ? 'bg-purple-900 hover:bg-purple-800 shadow-purple-900/20'
                                        : 'bg-blue-900 hover:bg-blue-800 shadow-blue-900/20'
                                        }`}
                                >
                                    <span>
                                        {saving
                                            ? 'Menyimpan...'
                                            : editingService
                                                ? 'Simpan Perubahan'
                                                : formCategory === 'ADDON'
                                                    ? 'Buat Add-on Baru'
                                                    : 'Buat Layanan Baru'}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Pengaturan Tahapan Produksi Mandiri */}
            <LaundryStageSettingsModal
                isOpen={showStageSettingsModal}
                onClose={() => setShowStageSettingsModal(false)}
                onSaved={(updatedStages) => {
                    setStoreStages(updatedStages);
                    showToast('Pengaturan tahapan produksi toko berhasil diperbarui!');
                }}
            />

            {/* Modal Takaran Bahan Cuci Otomatis (BoM) */}
            <LaundryServiceBomModal
                isOpen={showBomModal}
                onClose={() => {
                    setShowBomModal(false);
                    setSelectedBomService(null);
                }}
                service={selectedBomService}
                outletId={activeOutlet?.id}
                onSuccess={() => {
                    fetchServices();
                    showToast('Takaran bahan cuci (BoM) berhasil disimpan!');
                }}
            />

            {/* Floating Toast Feedback */}
            {feedback && (
                <div
                    className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${feedback.type === 'success'
                        ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                        : 'bg-rose-950 text-rose-100 border-rose-700'
                        }`}
                >
                    {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                </div>
            )}
        </div>
    );
};
