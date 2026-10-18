import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowDown, Check } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, onRefresh, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const canPull = useRef(false);
  const isPulling = useRef(false);
  const hasVibrated = useRef(false);

  // Deadzone untuk mengabaikan geseran kecil / scroll awal (minimal 40px gerakan jari sebelum mengaktifkan tarikan)
  const DEADZONE = 40;
  // Jarak tarik visual minimum dalam pixel untuk memicu refresh (~140px gerakan jari vertikal disengaja)
  const THRESHOLD = 72;
  // Batas maksimum tarikan visual (rubber-band limit)
  const MAX_PULL = 88;

  useEffect(() => {
    if (disabled) return;

    // Helper untuk memeriksa apakah elemen atau leluhurnya sedang berada dalam posisi scroll > 0
    const isAnyAncestorScrolled = (target: EventTarget | null): boolean => {
      let curr = target as HTMLElement | null;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        if (curr.scrollTop > 2) {
          return true;
        }
        curr = curr.parentElement;
      }
      if (
        window.scrollY > 2 ||
        (document.documentElement && document.documentElement.scrollTop > 2) ||
        (document.body && document.body.scrollTop > 2)
      ) {
        return true;
      }
      return false;
    };

    // Helper untuk mendeteksi apakah sentuhan terjadi di modal, sheet, drawer, atau input interaktif
    const isInsideExcludedElement = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;

      // Input form & kontrol interaktif langsung
      const tagName = el.tagName?.toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(tagName)) {
        return true;
      }

      // Dialog, modal pop-up, bottom sheet, atau elemen dengan instruksi anti-ptr
      if (
        el.closest('[role="dialog"]') ||
        el.closest('[data-no-ptr]') ||
        el.closest('.modal-overlay') ||
        el.closest('.no-ptr')
      ) {
        return true;
      }

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || e.touches.length !== 1) {
        canPull.current = false;
        return;
      }

      const touch = e.touches[0];
      const target = touch.target;

      // Jika sentuhan berada dalam elemen dialog/input atau elemen sedang ter-scroll ke bawah, matikan PTR
      if (isInsideExcludedElement(target) || isAnyAncestorScrolled(target)) {
        canPull.current = false;
        return;
      }

      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      canPull.current = true;
      isPulling.current = false;
      hasVibrated.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull.current || touchStartY.current === 0 || isRefreshing) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = Math.abs(touch.clientX - touchStartX.current);

      // Verifikasi ulang apakah ada container yang ter-scroll selama gesture
      if (isAnyAncestorScrolled(touch.target)) {
        canPull.current = false;
        isPulling.current = false;
        setPullDistance(0);
        return;
      }

      // Jika gerakan dominan horizontal atau diagonal (> 45 derajat), jangan aktifkan PTR
      if (deltaX * 1.6 > deltaY) {
        if (!isPulling.current) {
          canPull.current = false;
          return;
        }
      }

      // Hanya proses tarikan ke bawah jika melebihi DEADZONE
      if (deltaY > DEADZONE) {
        isPulling.current = true;
        const effectiveDelta = deltaY - DEADZONE;

        // Rubber-band resistance damping yang alami (makin ditarik makin berat)
        const damped = Math.min(MAX_PULL, Math.pow(effectiveDelta, 0.75) * 2.2);
        setPullDistance(damped);

        // Haptic feedback sekali saat threshold tercapai
        if (damped >= THRESHOLD && !hasVibrated.current) {
          hasVibrated.current = true;
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(25);
            } catch {
              // Abaikan jika tidak didukung
            }
          }
        } else if (damped < THRESHOLD) {
          hasVibrated.current = false;
        }

        // Cegah overscroll native hanya jika sudah benar-benar dalam mode pulling
        if (effectiveDelta > 15 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        if (isPulling.current) {
          setPullDistance(0);
          isPulling.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) {
        touchStartY.current = 0;
        canPull.current = false;
        isPulling.current = false;
        setPullDistance(0);
        return;
      }

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

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
        // Tarikan tidak mencapai ambang batas, kembali ke atas secara mulus
        setPullDistance(0);
      }

      touchStartY.current = 0;
      canPull.current = false;
      isPulling.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh, disabled]);

  const progressPercent = Math.min(100, Math.round((pullDistance / THRESHOLD) * 100));
  const isTriggerReady = pullDistance >= THRESHOLD;
  const rotationDegrees = Math.min(360, (pullDistance / THRESHOLD) * 360);

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
                <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600" />
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
