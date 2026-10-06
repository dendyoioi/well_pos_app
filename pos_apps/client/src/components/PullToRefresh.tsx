import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, onRefresh }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isPulling = useRef(false);

  const THRESHOLD = 64; // Jarak tarik minimum dalam pixel untuk memicu refresh
  const MAX_PULL = 96;  // Batas maksimum tarikan visual (rubber-band limit)

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Hanya aktif jika layar berada di puncak (scrollTop 0) dan sedang tidak refreshing
      if (window.scrollY > 5 || isRefreshing) return;

      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      isPulling.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === 0 || isRefreshing) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = Math.abs(touch.clientX - touchStartX.current);

      // Abaikan jika gerakan lebih condong horizontal (seperti scroll kategori produk)
      if (deltaX > Math.abs(deltaY) && !isPulling.current) return;

      // Hanya izinkan tarikan ke bawah saat scroll berada di paling atas
      if (deltaY > 0 && window.scrollY <= 0) {
        isPulling.current = true;
        // Rubber-band resistance damping
        const damped = Math.min(MAX_PULL, Math.pow(deltaY, 0.85) * 1.8);
        setPullDistance(damped);

        // Cegah overscroll Safari bawaan yang kaku jika sedang menarik indikator custom
        if (deltaY > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        isPulling.current = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) {
        touchStartY.current = 0;
        setPullDistance(0);
        return;
      }

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

        // Haptic feedback jika didukung perangkat smartphone
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(20);
          } catch {
            // Abaikan jika tidak diizinkan oleh OS
          }
        }

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default reload: Jika service worker aktif, minta update cache lalu reload bersih
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const reg of registrations) {
                await reg.update().catch(() => {});
              }
            }
            // Tunggu sesaat agar transisi visual putaran indikator terasa menyenangkan
            await new Promise((r) => setTimeout(r, 450));
            window.location.reload();
          }
        } catch (err) {
          console.error('[PullToRefresh] Error refreshing:', err);
          window.location.reload();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Tarikan tidak mencapai batas ambang, kembalikan ke atas
        setPullDistance(0);
      }

      touchStartY.current = 0;
      isPulling.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  const progressPercent = Math.min(100, Math.round((pullDistance / THRESHOLD) * 100));
  const isTriggerReady = pullDistance >= THRESHOLD;
  const rotationDegrees = (pullDistance / THRESHOLD) * 360;

  return (
    <>
      {/* Indikator Melayang Cantik di Atas (Tampil saat ditarik atau sedang refreshing) */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed inset-x-0 z-50 flex justify-center pointer-events-none transition-transform duration-150 ease-out"
          style={{
            top: `max(12px, env(safe-area-inset-top, 12px))`,
            transform: `translateY(${Math.min(pullDistance, MAX_PULL)}px)`,
          }}
        >
          <div className="bg-white/95 backdrop-blur-md border border-blue-200/80 shadow-lg shadow-blue-900/10 rounded-full px-3.5 py-1.5 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-blue-900 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              style={{
                transform: !isRefreshing ? `rotate(${rotationDegrees}deg)` : undefined,
                transition: isRefreshing ? 'none' : 'transform 0.1s linear',
              }}
            >
              {isRefreshing ? (
                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : isTriggerReady ? (
                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
            </div>
            <span className="text-[11px] font-black tracking-tight text-slate-800 select-none">
              {isRefreshing
                ? 'Memuat ulang data...'
                : isTriggerReady
                ? 'Lepaskan untuk memuat ulang'
                : `Tarik ke bawah (${progressPercent}%)`}
            </span>
          </div>
        </div>
      )}

      {/* Konten Aplikasi Utama dengan pergeseran elastis halus saat ditarik */}
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.35}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </>
  );
};
