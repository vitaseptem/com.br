// Supabase client (browser) — usa apenas ANON KEY
// Trocar para as variáveis do seu projeto (ou injetar via window.ENV no index.html)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = window.ENV?.SUPABASE_URL || "https://dwqkuwqmlhvplmgwksas.supabase.co";
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3cWt1d3FtbGh2cGxtZ3drc2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODM4NjksImV4cCI6MjA3MDM1OTg2OX0._pFblnBzx5cf0SUfAC_w-kmcdFbidZsh23XKXJR98ng";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: "vs_dashboard_auth" }
});
