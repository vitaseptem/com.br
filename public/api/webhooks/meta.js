import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { ok, json } from "../_lib/utils.js";

export default async function handler(req,res){
  if (req.method==="GET"){
    // validação de webhook do Meta (hub.challenge)
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "vs_meta_token";
    if (req.query["hub.verify_token"]===VERIFY_TOKEN) return res.status(200).send(req.query["hub.challenge"]);
    return json(res,403,{error:"forbidden"});
  }
  if (req.method!=="POST") return json(res,405,{error:"method_not_allowed"});

  const supa = getAdminClient();
  const body = req.body || {};
  await supa.from("integration_logs").insert({ provider:"meta", raw: body });
  return ok(res);
}
