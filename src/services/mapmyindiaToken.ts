const TOKEN_KEY = "mapmyindia_access_token";
const TOKEN_EXPIRY_KEY = "mapmyindia_token_expiry";

export const getMapMyIndiaToken = async () => {
  const resp = await fetch(
    "https://dxxoaxhrtjazzokuqvtf.supabase.co/functions/v1/mapmyindia-token",
    {
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    }
  );

  if (!resp.ok) throw new Error("Token API failed");

  const data = await resp.json();
  return data.access_token;
};

