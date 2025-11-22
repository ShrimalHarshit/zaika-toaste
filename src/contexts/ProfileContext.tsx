import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase";
import { useAuth } from "./AuthContext";

interface Profile {
  first_name: string;
  last_name: string;
  phone: string;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: any) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", user.id)
      .single();

    setProfile(data || null);

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [user]); // fetch profile only when user changes

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile: loadProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
};
