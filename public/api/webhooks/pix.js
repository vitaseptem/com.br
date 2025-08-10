import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { json, ok } from "../_lib/utils.js";
import crypto from "crypto";

export default async function handler(req,res){
  if (req.method!=="POST") return json(res,405,{error:"method_not_allowed"});
  const raw = await rawBody(req);
  const sig = req.headers["x-pix-signature"];
  const secret = process.env.PIX_WEBHOOK_SECRET||"";
  const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (sig !== h) return json(res,400,{ error:"invalid_signature" });

  const evt = JSON.parse(raw.toString("utf8"));
  const supa = getAdminClient();
  await supa.from("integration_logs").insert({ provider:"pix", raw: evt });

  if (evt?.status==="CONFIRMED" && evt?.txid){
    const orderId = evt?.metadata?.order_id || evt?.order_id;
    if (orderId) await supa.from("orders").update({ status:"paid" }).eq("id", orderId);
    await supa.from("payments").insert({ provider:"pix", provider_ref: evt.txid, status:"paid", amount_cents: evt.amount_cents||0, raw: evt });
  }
  return ok(res);
}
async function rawBody(req){ const chunks=[]; for await(const c of req) chunks.push(c); return Buffer.concat(chunks); }
