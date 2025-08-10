import { createClient } from "@supabase/supabase-js";

export function getAdminClient(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE ausentes");
  return createClient(url, key, { auth: { autoRefreshToken:false, persistSession:false } });
}
