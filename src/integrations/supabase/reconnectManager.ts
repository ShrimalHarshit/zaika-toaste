// src/integrations/supabase/reconnectManager.ts
import { supabase } from "./client";
import { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------
// RECONNECTION STATE
// ---------------------------------------------
let reconnecting = false;
let reconnectAttempts = 0;
let monitorChannel: RealtimeChannel | null = null;
const MAX_RECONNECT_ATTEMPTS = 5;

// Exponential backoff delays: 1s, 2s, 4s, 8s, 16s
const getBackoffDelay = (attempt: number): number => {
  return Math.min(1000 * Math.pow(2, attempt), 16000);
};

// ---------------------------------------------
// CONNECTION STATUS CALLBACKS
// ---------------------------------------------
type ConnectionCallback = (isConnected: boolean) => void;
const connectionCallbacks: Set<ConnectionCallback> = new Set();

export const onConnectionChange = (callback: ConnectionCallback) => {
  connectionCallbacks.add(callback);
   return () => {
    connectionCallbacks.delete(callback);
  };
};

const notifyConnectionChange = (isConnected: boolean) => {
  connectionCallbacks.forEach(cb => cb(isConnected));
};

// ---------------------------------------------
// REALTIME MONITOR CHANNEL (v2 compatible)
// ---------------------------------------------
const initializeMonitor = () => {
  if (monitorChannel) {
    return monitorChannel;
  }

  console.log("🔌 Initializing realtime monitor channel");

  monitorChannel = supabase.channel('connection-monitor', {
    config: {
      broadcast: { self: true },
    },
  });

  monitorChannel.subscribe((status) => {
    console.log("📡 Realtime status:", status);

    if (status === 'SUBSCRIBED') {
      console.log('✅ Realtime connected');
      reconnectAttempts = 0;
      reconnecting = false;
      notifyConnectionChange(true);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      console.warn('🔴 Realtime disconnected');
      notifyConnectionChange(false);
      
      // Only schedule reconnect if we're not already reconnecting
      if (!reconnecting) {
        scheduleReconnect();
      }
    }
  });

  return monitorChannel;
};

// ---------------------------------------------
// SILENT RECONNECT with exponential backoff
// ---------------------------------------------
const reconnectTimeout: { current: NodeJS.Timeout | null } = { current: null };

const scheduleReconnect = () => {
  if (reconnecting || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
      notifyConnectionChange(false);
    }
    return;
  }

  const delay = getBackoffDelay(reconnectAttempts);
  console.log(`⏳ Scheduling reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);

  if (reconnectTimeout.current) {
    clearTimeout(reconnectTimeout.current);
  }

  reconnectTimeout.current = setTimeout(() => {
    silentReconnect();
  }, delay);
};

export const silentReconnect = async () => {
  if (reconnecting) {
    console.log('⏭️ Reconnect already in progress, skipping...');
    return false;
  }

  reconnecting = true;
  reconnectAttempts++;

  console.warn(`🔌 Reconnecting to Supabase (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  try {
    // FIXED: Don't force refresh auth, just check if valid
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Session check error during reconnect:", error);
      // Don't throw - just continue with reconnect
    }

    // Unsubscribe old channel properly
    if (monitorChannel) {
      try {
        await monitorChannel.unsubscribe();
        monitorChannel = null;
      } catch (err) {
        console.warn("Error unsubscribing old channel:", err);
        monitorChannel = null;
      }
    }

    // Small delay before creating new channel
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reinitialize realtime channel
    monitorChannel = initializeMonitor();

    console.log('✅ Reconnection successful');
    reconnectAttempts = 0;
    reconnecting = false;
    notifyConnectionChange(true);
    return true;

  } catch (err) {
    console.error(`❌ Reconnection attempt ${reconnectAttempts} failed:`, err);
    reconnecting = false;
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      scheduleReconnect();
    } else {
      notifyConnectionChange(false);
    }
    
    return false;
  }
};

// ---------------------------------------------
// MANUAL RECONNECT (for user-triggered retry)
// ---------------------------------------------
export const forceReconnect = async () => {
  console.log("🔄 Force reconnect triggered");
  reconnectAttempts = 0;
  reconnecting = false;
  
  if (reconnectTimeout.current) {
    clearTimeout(reconnectTimeout.current);
    reconnectTimeout.current = null;
  }
  
  return silentReconnect();
};

// ---------------------------------------------
// HEARTBEAT (DISABLED - causes issues with auth)
// We rely on Supabase's built-in heartbeat instead
// ---------------------------------------------
let heartbeatInterval: NodeJS.Timeout | null = null;

const startHeartbeat = () => {
  // DISABLED: Manual heartbeats can interfere with auth state
  // Supabase handles its own connection maintenance
  return;
  
  /* ORIGINAL CODE - DISABLED
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(() => {
    if (!monitorChannel) return;

    try {
      monitorChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('Heartbeat failed:', err);
    }
  }, 30000);
  */
};

export const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

// ---------------------------------------------
// INITIALIZE
// ---------------------------------------------
// Only initialize monitor if document is visible
if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
  initializeMonitor();
  startHeartbeat();
}

// Handle visibility changes
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Tab became visible - check connection
      if (!monitorChannel || monitorChannel.state !== 'joined') {
        console.log("📱 Tab visible - checking realtime connection");
        if (!reconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          silentReconnect();
        }
      }
    }
  });
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    if (monitorChannel) {
      try {
        monitorChannel.unsubscribe();
      } catch (err) {
        console.warn("Error during cleanup:", err);
      }
    }
  });
}