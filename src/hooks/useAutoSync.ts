import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncAll, type SyncStatus } from '../services/syncService';

/** Triggers a background sync whenever connectivity is (re)gained, and exposes a manual trigger + last result. */
export function useAutoSync(userId: string | null) {
  const [lastStatus, setLastStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = useCallback(async () => {
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    setIsSyncing(true);
    try {
      const status = await syncAll(userId, isOnline);
      setLastStatus(status);
      return status;
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    runSync().catch(() => {});

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        runSync().catch(() => {});
      }
    });

    return unsubscribe;
  }, [runSync]);

  return { lastStatus, isSyncing, runSync };
}
