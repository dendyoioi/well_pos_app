import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Database,
  Building2,
  FileText,
  DollarSign,
  Users,
  Settings,
  Shield,
  Activity,
} from 'lucide-react';
import { enterpriseCore4Api } from '../../services/api';
import type { GlobalAuditLogRecord } from '../../types/enterprise_core4';
import type { Outlet } from '../../types/outlet';

interface GlobalAuditTrailPanelProps {
  activeOutlet?: Outlet | null;
}

const MODULE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.FC<any> }
> = {
  PROCUREMENT: {
    label: 'Pengadaan (Procurement)',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: FileText,
  },
  HR_PAYROLL: {
    label: 'SDM & Payroll',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Users,
  },
  FINANCE: {
    label: 'Keuangan & AP',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: DollarSign,
  },
  ORDER: {
    label: 'Pesanan & Kasir',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Activity,
  },
  PRICING: {
    label: 'Katalog & Harga',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: Database,
  },
  SECURITY: {
    label: 'Keamanan & Autentikasi',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: Shield,
  },
  SYSTEM: {
    label: 'Sistem & Konfigurasi',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    icon: Settings,
  },
};

export const GlobalAuditTrailPanel: React.FC<GlobalAuditTrailPanelProps> = ({ activeOutlet }) => {
  const [logs, setLogs] = useState<GlobalAuditLogRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Pagination
  const [limit] = useState<number>(30);
  const [offset, setOffset] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        limit,
        offset,
      };
      if (activeOutlet?.id) params.outletId = activeOutlet.id;
      if (selectedModule !== 'ALL') params.module = selectedModule;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await enterpriseCore4Api.getGlobalAuditLogs(params);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setLogs(res.data);
        setTotal(res.total || res.data.length);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, selectedModule, searchQuery, limit, offset]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Module Badges Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <button
          onClick={() => {
            setSelectedModule('ALL');
            setOffset(0);
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedModule === 'ALL'
              ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-sm'
          }`}
        >
          <span className="text-[11px] block font-medium opacity-80">Semua Modul</span>
          <p className="text-lg font-bold mt-0.5">{total}</p>
        </button>

        {Object.entries(MODULE_CONFIG).map(([modKey]) => {
          const count = summary[modKey] || 0;
          const isSelected = selectedModule === modKey;
          return (
            <button
              key={modKey}
              onClick={() => {
                setSelectedModule(modKey);
                setOffset(0);
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium opacity-80 truncate">{modKey}</span>
              </div>
              <p className="text-lg font-bold mt-0.5">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari aktivitas, pelaku, atau ringkasan log audit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setOffset(0);
              }}
              className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="ALL">Semua Modul</option>
              {Object.keys(MODULE_CONFIG).map((k) => (
                <option key={k} value={k}>
                  {MODULE_CONFIG[k]?.label || k}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            onClick={() => loadAuditLogs()}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
            title="Refresh Log"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Timeline Feed */}
      {loading ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          Memuat catatan audit log...
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          Tidak ada catatan aktivitas audit yang sesuai kriteria.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const mod = MODULE_CONFIG[log.module] || {
              label: log.module,
              bg: 'bg-slate-100',
              text: 'text-slate-700',
              border: 'border-slate-200',
              icon: Activity,
            };
            const Icon = mod.icon;
            const isExpanded = expandedLogId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl ${mod.bg} ${mod.text} flex items-center justify-center shrink-0 mt-0.5 border ${mod.border}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${mod.bg} ${mod.text} border ${mod.border}`}
                        >
                          {log.module}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {log.action}
                        </span>
                        {log.entityType && (
                          <span className="text-xs text-slate-400 font-mono">
                            #{log.entityType}
                            {log.entityId ? `:${log.entityId.slice(0, 8)}` : ''}
                          </span>
                        )}
                      </div>

                      <p className="font-semibold text-slate-800 text-sm mt-1.5">{log.summary}</p>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700">{log.actorName}</strong> (
                          {log.actorRole})
                        </span>
                        {log.outlet?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {log.outlet.name}
                          </span>
                        )}
                        {log.ipAddress && (
                          <span className="text-slate-400 font-mono">IP: {log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between shrink-0 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                    </div>

                    {(log.beforeData || log.afterData) && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-blue-900 font-medium hover:underline"
                      >
                        <span>{isExpanded ? 'Sembunyikan Data' : 'Lihat Data Perubahan'}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Json Data Details */}
                {isExpanded && (log.beforeData || log.afterData) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    {log.beforeData && (
                      <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100">
                        <span className="font-sans font-semibold text-rose-800 block mb-1">
                          Sebelum Perubahan (Before):
                        </span>
                        <pre className="overflow-x-auto text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(log.beforeData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.afterData && (
                      <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                        <span className="font-sans font-semibold text-emerald-800 block mb-1">
                          Sesudah Perubahan (After):
                        </span>
                        <pre className="overflow-x-auto text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(log.afterData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-slate-500">
              Menampilkan {offset + 1} - {Math.min(offset + limit, total)} dari {total} log
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset((prev) => prev + limit)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
