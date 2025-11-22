// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------
// ENV
// ---------------------------------------------
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://dxxoaxhrtjazzokuqvtf.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "YOUR_REDACTED_KEY_HERE";

// ---------------------------------------------
// CUSTOM FETCH with proper timeout handling
// ---------------------------------------------
const customFetch = (url: string, options: RequestInit = {}) => {
  const controller = new AbortController();

  // 30 second timeout for most operations
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .finally(() => clearTimeout(timeout))
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw err;
    });
};

// ---------------------------------------------
// CREATE CLIENT (Supabase v2 compatible)
// ---------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: "supabase-auth",
    flowType: "pkce",
  },
  global: {
    fetch: customFetch,
    headers: {
      "x-client-info": "supabase-js-web",
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  db: {
    schema: "public",
  },
});

// ---------------------------------------------
// LIGHTWEIGHT KEEP-ALIVE (safe for unauthenticated)
// Run every 60 seconds, use a public table or skip if not needed
// ---------------------------------------------
let keepAliveInterval: NodeJS.Timeout | null = null;

export const startKeepAlive = () => {
  if (keepAliveInterval) return;

  keepAliveInterval = setInterval(async () => {
    try {
      // FIXED: Use a lightweight query that doesn't require auth
      // Option 1: Query a public table (e.g., products)
      await supabase.from("products").select("id").limit(1).maybeSingle();
      
      // Option 2: Just check auth session without querying tables
      // await supabase.auth.getSession();
    } catch (err) {
      // Silently fail - this is just a keep-alive
      // Don't log to avoid console spam
    }
  }, 60000); // Every 60 seconds
};

export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

// Start keep-alive automatically
startKeepAlive();

// Throttled token refresh logging
let lastRefreshLog = 0;

supabase.auth.onAuthStateChange((event) => {
  if (event === "TOKEN_REFRESHED") {
    const now = Date.now();
    // Only log once per minute
    if (now - lastRefreshLog > 60000) {
      console.log("🔄 Auth token refreshed");
      lastRefreshLog = now;
    }
  }
});