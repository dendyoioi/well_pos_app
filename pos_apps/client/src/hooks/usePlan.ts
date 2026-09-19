import { useState, useEffect } from 'react';
import { authStorage } from '../services/api';
import type { TenantSubscriptionInfo } from '../types/auth';

export interface UsePlanReturn {
  subscription: TenantSubscriptionInfo | null;
  planCode: 'FREE' | 'PRO' | string;
  isPro: boolean;
  isFree: boolean;
  features: string[];
  hasFeature: (featureCode: string) => boolean;
}

export const usePlan = (): UsePlanReturn => {
  const [user, setUser] = useState(() => authStorage.getUser());

  useEffect(() => {
    // Sinkronisasi state jika ada update session
    const handleStorageChange = () => {
      setUser(authStorage.getUser());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const subscription = user?.subscription || null;
  const planCode = subscription?.planCode || 'FREE';
  const isPro = planCode === 'PRO' || subscription?.isPro === true;
  const isFree = !isPro;
  const features = subscription?.features || (isPro ? ['ALL_FEATURES'] : ['BASIC_POS', 'RECEIPT_WATERMARK']);

  const hasFeature = (featureCode: string): boolean => {
    if (isPro) return true;
    if (features.includes('ALL_FEATURES')) return true;
    return features.includes(featureCode);
  };

  return {
    subscription,
    planCode,
    isPro,
    isFree,
    features,
    hasFeature,
  };
};
