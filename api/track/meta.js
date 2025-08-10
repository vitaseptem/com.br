import fetch from "node-fetch";
import { ok, bad } from "../_lib/utils.js";

export default async function handler(req,res){
  if (req.method!=="POST") return bad(res,"method_not_allowed");
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PIXEL_ID || !TOKEN) return bad(res,"meta_env_missing");
  const { data } = req.body||{};
  const r = await fetch(`https://graph.facebook.com/v17.0/${PIXEL_ID}/events?access_token=${TOKEN}`, {
    method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ data })
  });
  const txt = await r.text();
  return ok(res, { status:r.status, body:txt });
}
