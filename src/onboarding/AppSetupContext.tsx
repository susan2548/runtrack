import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getProfile } from '../db/profileRepository';

interface AppSetupValue {
  ready: boolean;
  onboardingCompleted: boolean;
  refresh: () => Promise<void>;
}

const AppSetupContext = createContext<AppSetupValue | null>(null);

export function AppSetupProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const refresh = useCallback(async () => {
    const profile = await getProfile();
    setOnboardingCompleted(profile.onboarding_completed === 1);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ ready, onboardingCompleted, refresh }),
    [onboardingCompleted, ready, refresh]
  );
  return <AppSetupContext.Provider value={value}>{children}</AppSetupContext.Provider>;
}

export function useAppSetup() {
  const context = useContext(AppSetupContext);
  if (!context) throw new Error('useAppSetup must be used inside AppSetupProvider');
  return context;
}
