// src/contexts/AdminAuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
  undefined
);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔥 ADMIN CHECK ONLY DURING LOGIN
  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    return !!data;
  };

  // 🔥 Listener ONLY restores session – no admin check here
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (session?.user) {
            setAdminUser({
              id: session.user.id,
              email: session.user.email ?? "",
            });
          }
          setLoading(false);
        }

        if (event === "SIGNED_OUT") {
          setAdminUser(null);
          setLoading(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // 🔥 Login handles admin check + set state
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Invalid login");
        return false;
      }

      const user = data.user;
      if (!user) return false;

      const isAdmin = await checkAdminRole(user.id);
      if (!isAdmin) {
        toast.error("This account does not have admin access.");
        await supabase.auth.signOut();
        return false;
      }

      // Save admin user
      setAdminUser({
        id: user.id,
        email: user.email ?? "",
      });

      return true;
    } catch {
      toast.error("Login failed.");
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
    navigate("/admin/login");
  };

  const value: AdminAuthContextType = {
    adminUser,
    loading,
    isAuthenticated: !!adminUser,
    isAdmin: !!adminUser,
    login,
    logout,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx)
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
};
