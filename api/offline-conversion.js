import { getAdminClient } from "./_lib/supabaseAdmin.js";
import { ok, bad } from "./_lib/utils.js";

export default async function handler(req,res){
  if (req.method!=="POST") return bad(res,"method_not_allowed");
  const { provider, payload } = req.body||{};
  if (!provider || !payload) return bad(res,"missing_params");
  const supa = getAdminClient();
  await supa.from("offline_conversions_queue").insert({ provider, payload });
  return ok(res);
}
