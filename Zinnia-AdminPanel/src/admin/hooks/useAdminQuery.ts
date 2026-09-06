import { useState, useEffect, useCallback, useRef } from 'react';
import { adminFetch } from '../auth/adminFetch';

interface UseAdminQueryOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

export function useAdminQuery<T>(
  url: string,
  options: UseAdminQueryOptions = {}
) {
  const { pollingInterval = 30000, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await adminFetch<T>(url);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();

    const startPolling = () => {
      if (pollingInterval > 0 && !timerRef.current) {
        timerRef.current = setInterval(() => {
          if (document.visibilityState === 'visible') {
            fetchData(true);
          }
        }, pollingInterval);
      }
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [url, pollingInterval, enabled, fetchData]);

  return { data, loading, error, refetch: () => fetchData(false) };
}
