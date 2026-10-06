import { useState, useEffect, useCallback } from 'react';
import { pwaService } from '../services/pwa.service';

export function usePwaInstall() {
  const [state, setState] = useState(() => pwaService.getStatus());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaService.addListener((newStatus) => {
      setState(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const installApp = useCallback(async () => {
    setInstalling(true);
    try {
      const outcome = await pwaService.promptInstall();
      return outcome;
    } finally {
      setInstalling(false);
    }
  }, []);

  return {
    isInstallable: state.isInstallable,
    isInstalled: state.isInstalled,
    isIos: state.isIos,
    installing,
    installApp,
  };
}
