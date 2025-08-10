import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { json, ok, bad } from "../_lib/utils.js";
import Stripe from "stripe";

export default async function handler(req,res){
  if (req.method!=="POST") return bad(res,"method_not_allowed");
  const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion:"2023-10-16" });
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(await getRawBody(req), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return json(res, 400, { error: `signature_verification_failed: ${err.message}` });
  }

  const supa = getAdminClient();
  // idempotência simples
  await supa.from("integration_logs").insert({ provider:"stripe", raw: event });

  if (event.type==="payment_intent.succeeded"){
    const pi = event.data.object;
    // relacione com order/payment pelo metadata.order_id, se disponível
    const orderId = pi.metadata?.order_id;
    if (orderId) await supa.from("orders").update({ status:"paid" }).eq("id", orderId);
    await supa.from("payments").insert({ provider:"stripe", provider_ref: pi.id, status:"paid", amount_cents: pi.amount_received, raw: pi });
  }
  if (event.type==="charge.refunded"){
    const ch = event.data.object;
    await supa.from("refunds").insert({ provider:"stripe", provider_ref: ch.id, amount_cents: ch.amount_refunded||0, raw: ch });
  }

  return ok(res);
}

async function getRawBody(req){
  const chunks=[]; for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
