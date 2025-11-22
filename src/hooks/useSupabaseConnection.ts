// src/hooks/useSupabaseConnection.ts
import { useState, useEffect } from 'react';
import { onConnectionChange, forceReconnect } from '@/integrations/supabase/reconnectManager';

/**
 * Hook to monitor Supabase connection status
 * Returns connection state and manual reconnect function
 */
export const useSupabaseConnection = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setIsReconnecting(false);
      }
    });

    return unsubscribe;
  }, []);

  const reconnect = async () => {
    setIsReconnecting(true);
    const success = await forceReconnect();
    setIsReconnecting(false);
    return success;
  };

  return {
    isConnected,
    isReconnecting,
    reconnect,
  };
};