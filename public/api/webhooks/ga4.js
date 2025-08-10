import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { ok } from "../_lib/utils.js";
export default async function handler(req,res){
  const supa = getAdminClient();
  await supa.from("integration_logs").insert({ provider:"ga4", raw: req.body||{} });
  return ok(res);
}
