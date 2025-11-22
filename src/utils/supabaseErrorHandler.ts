import { supabase } from '@/integrations/supabase';

// Periodically check connection health
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

// Reconnect on network issues
export const reconnectSupabase = async (): Promise<void> => {
  try {
    await supabase.auth.getSession();
  } catch (error) {
    console.error('Failed to reconnect:', error);
  }
};