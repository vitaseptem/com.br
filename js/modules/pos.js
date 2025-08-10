import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { toBRL } from "../lib/helpers.js";

const cart = []; // { product_id, sku, title, unit_cents, qty }
function byId(id){ return document.getElementById(id); }

function render(){
  const tb = byId("cartRows");
  tb.innerHTML = cart.map((it,idx)=> `
    <tr class="row">
      <td>${it.sku}</td>
      <td>${it.title}</td>
      <td class="text-right">${it.qty}</td>
      <td class="text-right">${toBRL(it.unit_cents)}</td>
      <td class="text-right">${toBRL(it.unit_cents*it.qty)}</td>
      <td class="text-right"><button class="btn ghost" data-act="del" data-idx="${idx}">Remover</button></td>
    </tr>`).join("");

  tb.querySelectorAll("button[data-act='del']").forEach(btn=>{
    btn.addEventListener("click", ()=> { cart.splice(Number(btn.dataset.idx),1); render(); });
  });

  const discount = Number(byId("discount").value||0);
  const sum = cart.reduce((a,b)=> a + b.unit_cents*b.qty, 0);
  const total = Math.max(0, sum - discount);
  byId("total").textContent = toBRL(total);
}

async function addItem(){
  const sku = byId("sku").value.trim();
  const qty = Number(byId("qty").value||1);
  if (!sku || qty<=0){ toast("Informe SKU e quantidade.", "error"); return; }
  const { data: p } = await supabase.from("products").select("id,sku,title,price_cents").eq("sku", sku).single();
  if (!p){ toast("Produto não encontrado.", "error"); return; }
  const idx = cart.findIndex(x=> x.product_id===p.id && x.unit_cents===(p.price_cents||0));
  if (idx>=0) cart[idx].qty += qty;
  else cart.push({ product_id: p.id, sku: p.sku, title: p.title, unit_cents: p.price_cents||0, qty });
  byId("sku").value=""; byId("qty").value="1"; render();
}

function clearCart(){
  cart.splice(0, cart.length);
  byId("discount").value = "0";
  byId("received").value = "0";
  byId("custEmail").value = "";
  byId("notes").value = "";
  render();
}

async function finishSale(){
  if (!cart.length){ toast("Carrinho vazio.", "error"); return; }
  const discount = Number(byId("discount").value||0);
  const sum = cart.reduce((a,b)=> a + b.unit_cents*b.qty, 0);
  const total = Math.max(0, sum - discount);
  const email = byId("custEmail").value.trim() || null;
  const pay = byId("payMethod").value;
  const received = Number(byId("received").value||0);

  if (pay!=="pix" && received<total){ toast("Valor recebido insuficiente.", "error"); return; }

  // cria pedido
  const { data: order, error } = await supabase.from("orders").insert({
    status: (pay==="pix" ? "processing" : "paid"),
    customer_email: email,
    total_cents: total,
    discount_cents: discount,
    notes: byId("notes").value.trim() || null,
    payment_method: pay
  }).select().single();
  if (error){ toast("Erro ao criar pedido.", "error"); return; }

  // cria itens + baixa estoque
  for (const it of cart){
    await supabase.from("order_items").insert({
      order_id: order.id, product_id: it.product_id, sku: it.sku, title: it.title,
      qty: it.qty, unit_cents: it.unit_cents, subtotal_cents: it.unit_cents*it.qty
    });
    await supabase.from("inventory_movements").insert({ product_id: it.product_id, delta: -it.qty, reason:"order_fulfillment" });
    const { data: inv } = await supabase.from("inventory").select("qty").eq("product_id", it.product_id).single();
    if (inv) await supabase.from("inventory").update({ qty: (inv.qty||0)-it.qty }).eq("product_id", it.product_id);
  }

  // PIX (placeholder: integraremos na PARTE 8 via /api/webhooks/pix)
  if (pay==="pix"){
    toast("PIX em processamento (webhook integrará o pagamento).", "info");
  }

  toast("Venda concluída.", "success");
  clearCart();
  // abre o pedido
  window.location.href = "/orders.html";
}

export function init(){
  byId("btnAdd").addEventListener("click", addItem);
  byId("btnClear").addEventListener("click", clearCart);
  byId("btnFinish").addEventListener("click", finishSale);
  byId("discount").addEventListener("input", render);
  // suporte "leitor de código de barras" (Enter no campo SKU)
  byId("sku").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); addItem(); }});
  render();
}
window.VS_POS = { init };
