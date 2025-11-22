// ----------------------------------------------------
// SUPER SIMPLE AUTH CONTEXT - STABLE + NO COMPLEXITY
// ----------------------------------------------------

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

// Define a type for the registration data
interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

interface SimpleUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: SimpleUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------
  // Convert Supabase user → SimpleUser shape
  // ----------------------------------------------------
  const convertUser = (u: SupabaseUser | null): SimpleUser | null => {
    if (!u) return null;
    return { id: u.id, email: u.email ?? "" };
  };

  // ----------------------------------------------------
  // INITIAL SESSION LOAD (runs once)
  // ----------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(convertUser(data.session?.user ?? null));
      setLoading(false);
    };
    init();

    // ----------------------------------------------------
    // AUTH LISTENER (simple, safe)
    // ----------------------------------------------------
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setUser(convertUser(session?.user ?? null));
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------
  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  };

  // ----------------------------------------------------
  // REGISTER
  // ----------------------------------------------------
  const register = async ({ email, password, firstName, lastName, phone }: RegisterData) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Store extra user data in user_metadata
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone,
          },
        },
      });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  };

  // ----------------------------------------------------
  // LOGIN WITH GOOGLE
  // ----------------------------------------------------
  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  };

  // ----------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("supabase-auth");
  };

  // ----------------------------------------------------
  // RESET PASSWORD
  // ----------------------------------------------------
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Use the /auth/confirm endpoint approach
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });
      
      if (error) {
        console.error('Password reset error:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};