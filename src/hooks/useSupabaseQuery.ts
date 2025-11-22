// src/hooks/useSupabaseQuery.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { PostgrestError } from '@supabase/supabase-js';

interface UseSupabaseQueryOptions<T> {
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  retry?: number;
  retryDelay?: number;
  staleTime?: number; // Time in ms before data is considered stale
}

interface UseSupabaseQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: PostgrestError | null;
  refetch: () => Promise<void>;
}

// Global queue to limit concurrent requests
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent = 3; // Max 3 concurrent requests

  async add<T>(fn: () => Promise<T>): Promise<T> {
    while (this.activeCount >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
    }
  }
}

const requestQueue = new RequestQueue();

export function useSupabaseQuery<T>(
  options: UseSupabaseQueryOptions<T>
): UseSupabaseQueryResult<T> {
  const {
    queryFn,
    enabled = true,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
    retry = 2, // Reduced from 3
    retryDelay = 1000,
    staleTime = 30000, // 30 seconds default
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<PostgrestError | null>(null);
  const lastFetchTime = useRef<number>(0);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (attempt = 1): Promise<void> => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    // Check if data is still fresh
    const now = Date.now();
    if (data && (now - lastFetchTime.current) < staleTime) {
      console.log('Data is still fresh, skipping fetch');
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // Use the request queue to limit concurrent requests
      const result = await requestQueue.add(async () => {
        return await queryFn();
      });

      if (!mountedRef.current) return;

      if (result.error) {
        throw result.error;
      }

      setData(result.data);
      lastFetchTime.current = Date.now();
      setIsLoading(false);
    } catch (err: any) {
      if (!mountedRef.current) return;

      console.error(`Query failed (attempt ${attempt}/${retry}):`, err);

      if (attempt < retry) {
        // Exponential backoff with jitter
        const delay = retryDelay * attempt + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (mountedRef.current) {
          isFetchingRef.current = false;
          return fetchData(attempt + 1);
        }
      } else {
        setIsError(true);
        setError(err);
        setIsLoading(false);
      }
    } finally {
      if (mountedRef.current) {
        isFetchingRef.current = false;
      }
    }
  }, [queryFn, enabled, retry, retryDelay, data, staleTime]);

  // Initial fetch
  useEffect(() => {
    if (refetchOnMount) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData, refetchOnMount]);

  // Refetch on window focus with debounce
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    let timeoutId: NodeJS.Timeout;
    
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        // Debounce refetch by 500ms
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          console.log('Window focused - refetching data...');
          fetchData();
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      clearTimeout(timeoutId);
    };
  }, [fetchData, refetchOnWindowFocus]);

  const refetch = useCallback(async () => {
    lastFetchTime.current = 0; // Force refetch even if data is fresh
    await fetchData();
  }, [fetchData]);

  return { data, isLoading, isError, error, refetch };
}