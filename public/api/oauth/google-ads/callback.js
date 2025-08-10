import fetch from "node-fetch";
import { getAdminClient } from "../../_lib/supabaseAdmin.js";
import { ok, bad } from "../../_lib/utils.js";

export default async function handler(req,res){
  const code = req.query.code;
  if (!code) return bad(res,"missing_code");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method:"POST", headers:{ "content-type":"application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  const tok = await r.json();
  const supa = getAdminClient();
  await supa.from("integration_credentials").upsert({
    provider:"google_ads", access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: new Date(Date.now()+(tok.expires_in||3600)*1000).toISOString()
  }, { onConflict:"provider" });
  return ok(res, { connected:true });
}
