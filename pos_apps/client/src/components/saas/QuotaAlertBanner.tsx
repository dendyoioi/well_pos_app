import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Coins,
  ArrowRight,
} from 'lucide-react';
import type { User } from '../../types/auth';
import { api, businessApi } from '../../services/api';

export interface QuotaAlertBannerProps {
  user: User;
  onOpenOwnerPortal?: (tab?: 'businesses' | 'tokens' | 'invoices') => void;
  className?: string;
}

export const QuotaAlertBanner: React.FC<QuotaAlertBannerProps> = ({
  user,
  onOpenOwnerPortal,
  className = '',
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [remainingTokens, setRemainingTokens] = useState<number | null>(null);
  const [estimatedDaysLeft, setEstimatedDaysLeft] = useState<number | null>(null);
  const [daysRemainingSubscription, setDaysRemainingSubscription] = useState<number | null>(null);

  const isOwnerOrAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

  useEffect(() => {
    let isMounted = true;

    const fetchQuotaStatus = async () => {
      try {
        setLoading(true);

        // 1. Ambil data langganan dasar (dapat diakses oleh seluruh peran yang terautentikasi)
        const subRes = await api.getMySubscription().catch(() => null);
        if (isMounted && subRes?.status === 'success' && subRes.data) {
          if (typeof subRes.data.daysRemaining === 'number') {
            setDaysRemainingSubscription(subRes.data.daysRemaining);
          }
          if (subRes.data.quota && typeof subRes.data.quota.remainingQuota === 'number') {
            setRemainingTokens(subRes.data.quota.remainingQuota);
          }
        }

        // 2. Jika user adalah OWNER, ambil detail dompet token bersama (run rate & days left)
        if (user.role === 'OWNER') {
          const tokenRes = await businessApi.getBusinessTokenSummary().catch(() => null);
          if (isMounted && tokenRes?.status === 'success' && tokenRes.data) {
            setRemainingTokens(tokenRes.data.remainingTokens);
            setEstimatedDaysLeft(tokenRes.data.estimatedDaysLeft);
          }
        }
      } catch (err) {
        // Hening jika gagal agar tidak mengganggu operasional kasir
        console.warn('Gagal memuat status kuota:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuotaStatus();

    return () => {
      isMounted = false;
    };
  }, [user.role, user.tenantId]);

  // Jangan render apa pun jika masih loading awal atau data belum tersedia
  if (loading || remainingTokens === null) {
    return null;
  }

  // Parameter Kritis Sesuai Spesifikasi:
  // - Status CRITICAL (merah): sisa token <= 0 ATAU masa aktif lisensi/langganan <= 3 hari.
  // - Status WARNING (kuning): sisa token > 0 dan (sisa token < 50 ATAU estimasi habis <= 3 hari operasional).
  const isTokenEmpty = remainingTokens <= 0;
  const isSubscriptionExpiring =
    daysRemainingSubscription !== null && daysRemainingSubscription <= 3;
  const isCritical = isTokenEmpty || isSubscriptionExpiring;

  const isTokenLow =
    remainingTokens > 0 &&
    (remainingTokens < 50 || (estimatedDaysLeft !== null && estimatedDaysLeft <= 3));
  const isWarning = !isCritical && isTokenLow;

  // Jika kuota dalam kondisi aman, jangan render apa pun agar tidak memakan ruang layar
  if (!isCritical && !isWarning) {
    return null;
  }

  const handleNavigateTokens = () => {
    if (onOpenOwnerPortal) {
      onOpenOwnerPortal('tokens');
    }
  };

  return (
    <div
      className={`w-full rounded-2xl p-3.5 sm:p-4 mb-4 sm:mb-6 transition-all animate-fadeIn ${
        isCritical
          ? 'bg-rose-50 border border-rose-200 text-rose-950 shadow-sm'
          : 'bg-amber-50 border border-amber-200 text-amber-950 shadow-sm'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Sisi Kiri: Ikon & Teks Notifikasi */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCritical
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-amber-500 text-white shadow-xs'
            }`}
          >
            {isCritical ? (
              <AlertOctagon className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isCritical
                    ? 'bg-rose-200 text-rose-900 border border-rose-300'
                    : 'bg-amber-200 text-amber-900 border border-amber-300'
                }`}
              >
                {isCritical ? 'Perhatian Kritis' : 'Peringatan Kuota'}
              </span>

              {isOwnerOrAdmin && (
                <span className="text-xs font-mono font-bold text-slate-700">
                  Sisa: <strong className="font-black text-slate-900">{remainingTokens.toLocaleString('id-ID')} Token</strong>
                  {estimatedDaysLeft !== null && ` (~${estimatedDaysLeft} hari)`}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold mt-0.5 leading-snug">
              {isOwnerOrAdmin ? (
                isCritical ? (
                  isTokenEmpty ? (
                    'Kuota token transaksi telah habis (0 Token). Transaksi kasir & order online terhenti.'
                  ) : (
                    `Masa aktif langganan tersisa ${daysRemainingSubscription} hari. Segera perpanjang agar tidak terputus.`
                  )
                ) : (
                  `Kuota transaksi menipis (Tersisa ${remainingTokens.toLocaleString('id-ID')} Token). Isi ulang sekarang untuk kelancaran operasional kasir.`
                )
              ) : (
                'Kuota transaksi menipis/habis — silakan hubungi Pemilik Usaha untuk pengisian kuota di Portal Hub.'
              )}
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Aksi (Hanya untuk Owner / Admin) */}
        {isOwnerOrAdmin && onOpenOwnerPortal && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto">
            <button
              type="button"
              onClick={handleNavigateTokens}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                isCritical
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>Isi Kuota di Portal Hub</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
