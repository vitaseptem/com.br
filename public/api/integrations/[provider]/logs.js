import { getAdminClient } from "../../_lib/supabaseAdmin.js";

export default async function handler(req,res){
  const supa = getAdminClient();
  const provider = req.query.provider;
  const { data } = await supa.from("integration_logs").select("*").eq("provider", provider).order("created_at",{ascending:false}).limit(50);
  res.setHeader("content-type","application/json"); res.end(JSON.stringify(data||[]));
}
