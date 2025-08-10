import fetch from "node-fetch";
import { ok, bad } from "../_lib/utils.js";

export default async function handler(req,res){
  if (req.method!=="POST") return bad(res,"method_not_allowed");
  const { client_id, events=[] } = req.body||{};
  const MEAS_ID = process.env.GA4_MEASUREMENT_ID;
  const API_SECRET = process.env.GA4_API_SECRET;
  if (!MEAS_ID || !API_SECRET) return bad(res,"ga4_env_missing");
  const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MEAS_ID}&api_secret=${API_SECRET}`, {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify({ client_id: client_id || "555.555", events })
  });
  const txt = await r.text();
  return ok(res, { status:r.status, body:txt });
}
