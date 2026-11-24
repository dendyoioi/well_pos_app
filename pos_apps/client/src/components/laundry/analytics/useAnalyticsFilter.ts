// Well POS - useAnalyticsFilter Hook
// Sinkronisasi state filter global, URL query params, dan AbortController lifecycle

import { useState, useEffect, useRef, useCallback } from 'react';
import { authStorage } from '../../../services/api';
import type { AnalyticsQueryParams } from '../../../types/laundryAnalytics';
import type { Outlet } from '../../../types/outlet';

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | '7days'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export interface AnalyticsFilterState {
  preset: AnalyticsDatePreset;
  startDate: string;
  endDate: string;
  outletId: string;
  activeSubTab: string;
}

export function useAnalyticsFilter(activeOutlet?: Outlet | null) {
  const user = authStorage.getUser();
  const isOwner = user?.role === 'OWNER';
  const assignedOutletId = user?.outletId || '';
  const canSwitchOutlet = isOwner || (user?.role === 'ADMIN' && !user?.outletId);
  const initialDefaultOutlet = assignedOutletId
    ? assignedOutletId
    : (activeOutlet?.id || 'ALL');
  const defaultSubTab = user?.role === 'SUPERVISOR' ? 'operations' : 'financial';

  // Baca URL query params saat mount awal
  const getInitialState = (): AnalyticsFilterState => {
    if (typeof window === 'undefined') {
      return {
        preset: 'month',
        startDate: '',
        endDate: '',
        outletId: initialDefaultOutlet,
        activeSubTab: defaultSubTab,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const pPreset = params.get('preset') as AnalyticsDatePreset;
    const pStart = params.get('startDate') || '';
    const pEnd = params.get('endDate') || '';
    const pOutlet = params.get('outletId');
    const pTab = params.get('subtab');

    const validPresets: AnalyticsDatePreset[] = [
      'today',
      'yesterday',
      'this_week',
      '7days',
      'month',
      'last_month',
      'year',
      'custom',
    ];

    const preset = validPresets.includes(pPreset) ? pPreset : 'month';
    const outletId = assignedOutletId
      ? assignedOutletId
      : (pOutlet || initialDefaultOutlet);
    const activeSubTab = pTab || defaultSubTab;

    return {
      preset,
      startDate: pStart,
      endDate: pEnd,
      outletId,
      activeSubTab,
    };
  };

  const [state, setState] = useState<AnalyticsFilterState>(getInitialState);
  const [dateError, setDateError] = useState<string | null>(null);

  // AbortController management
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAbortSignal = useCallback((): AbortSignal => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;
    return ac.signal;
  }, []);

  // Cleanup abort controller saat unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Sinkronkan state ke URL via window.history.replaceState
  const syncToUrl = useCallback((nextState: AnalyticsFilterState) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('preset', nextState.preset);

    if (nextState.preset === 'custom' && nextState.startDate && nextState.endDate) {
      url.searchParams.set('startDate', nextState.startDate);
      url.searchParams.set('endDate', nextState.endDate);
    } else {
      url.searchParams.delete('startDate');
      url.searchParams.delete('endDate');
    }

    url.searchParams.set('outletId', nextState.outletId);
    url.searchParams.set('subtab', nextState.activeSubTab);

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  // Sinkronkan outletId saat user mengganti activeOutlet di dropdown top-bar Well POS (selama tidak manual ALL)
  useEffect(() => {
    if (!canSwitchOutlet) return;
    if (activeOutlet?.id && state.outletId !== 'ALL' && state.outletId !== activeOutlet.id) {
      setState((prev) => {
        if (prev.outletId === 'ALL') return prev;
        const next = { ...prev, outletId: activeOutlet.id };
        syncToUrl(next);
        return next;
      });
    }
  }, [activeOutlet?.id, canSwitchOutlet, state.outletId, syncToUrl]);

  // Setter Handlers
  const setPreset = useCallback((preset: AnalyticsDatePreset) => {
    setDateError(null);
    setState((prev) => {
      const next = { ...prev, preset };
      syncToUrl(next);
      return next;
    });
  }, [syncToUrl]);

  const setCustomDateRange = useCallback((startDate: string, endDate: string) => {
    if (startDate && endDate && startDate > endDate) {
      setDateError('Tanggal awal tidak boleh lebih besar dari tanggal akhir');
      return false;
    }
    setDateError(null);
    setState((prev) => {
      const next: AnalyticsFilterState = {
        ...prev,
        preset: 'custom',
        startDate,
        endDate,
      };
      syncToUrl(next);
      return next;
    });
    return true;
  }, [syncToUrl]);

  const setOutletId = useCallback((outletId: string) => {
    if (!canSwitchOutlet) return; // Non-owner / branch-restricted tidak boleh ganti outlet
    setState((prev) => {
      const next = { ...prev, outletId };
      syncToUrl(next);
      return next;
    });
  }, [canSwitchOutlet, syncToUrl]);

  const setActiveSubTab = useCallback((activeSubTab: string) => {
    setState((prev) => {
      const next = { ...prev, activeSubTab };
      syncToUrl(next);
      return next;
    });
  }, [syncToUrl]);

  const getQueryParams = useCallback((): AnalyticsQueryParams => {
    const params: AnalyticsQueryParams = {
      preset: state.preset,
      outletId: state.outletId,
    };
    if (state.preset === 'custom' && state.startDate && state.endDate) {
      params.startDate = state.startDate;
      params.endDate = state.endDate;
    }
    return params;
  }, [state]);

  return {
    ...state,
    isOwner,
    canSwitchOutlet,
    userRole: user?.role,
    dateError,
    setPreset,
    setCustomDateRange,
    setOutletId,
    setActiveSubTab,
    getQueryParams,
    getAbortSignal,
  };
}
