import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { toBRL } from "../lib/helpers.js";

const state = { page:1, pageSize:12, total:0, q:"", status:"", d1:"", d2:"" };
function byId(id){ return document.getElementById(id); }

function rowTemplate(o){
  const updated = new Date(o.updated_at||o.created_at).toLocaleString("pt-BR");
  return `
    <tr class="row">
      <td>${o.order_number||o.id}</td>
      <td>${o.customer_name||o.customer_email||"—"}</td>
      <td>${o.status}</td>
      <td class="text-right">${o.items_count||0}</td>
      <td class="text-right">${toBRL(o.total_cents||0)}</td>
      <td>${updated}</td>
      <td class="text-right">
        <button class="btn secondary" data-act="view" data-id="${o.id}">Abrir</button>
        <button class="btn ghost" data-act="status" data-id="${o.id}">Alterar status</button>
      </td>
    </tr>
  `;
}

async function query(){
  // Tenta orders_view (com items_count), senão fallback
  let builder = supabase.from("orders_view").select("*", { count:"exact" });
  if (state.q) builder = builder.or(`order_number.ilike.%${state.q}%,customer_email.ilike.%${state.q}%`);
  if (state.status) builder = builder.eq("status", state.status);
  if (state.d1) builder = builder.gte("created_at", new Date(state.d1+"T00:00:00").toISOString());
  if (state.d2) builder = builder.lte("created_at", new Date(state.d2+"T23:59:59").toISOString());
  builder = builder.order("created_at", { ascending:false }).range((state.page-1)*state.pageSize, state.page*state.pageSize-1);
  let { data, error, count } = await builder;
  if (error){
    // fallback
    const base = supabase.from("orders").select("*", { count:"exact" });
    let b = base;
    if (state.q) b = b.or(`id.eq.${state.q},customer_email.ilike.%${state.q}%`);
    if (state.status) b = b.eq("status", state.status);
    if (state.d1) b = b.gte("created_at", new Date(state.d1+"T00:00:00").toISOString());
    if (state.d2) b = b.lte("created_at", new Date(state.d2+"T23:59:59").toISOString());
    const res = await b.order("created_at", { ascending:false }).range((state.page-1)*state.pageSize, state.page*state.pageSize-1);
    count = res.count||0; data = res.data||[];
    // agrega items_count
    for (const o of data){
      const { data: items } = await supabase.from("order_items").select("qty").eq("order_id", o.id);
      o.items_count = (items||[]).reduce((a,b)=> a+(b.qty||0), 0);
    }
  }
  return { rows: data||[], total: count||0 };
}

function render(rows){
  const tb = byId("rows");
  tb.innerHTML = rows.map(rowTemplate).join("");
  tb.querySelectorAll("button[data-act]").forEach(btn=>{
    const id = btn.dataset.id, act = btn.dataset.act;
    btn.addEventListener("click", ()=> handleRowAction(act,id));
  });
  byId("pagingInfo").textContent = `Página ${state.page} • ${state.total} pedidos`;
}

async function load(){ const { rows, total } = await query(); state.total=total; render(rows); }

function bindToolbar(){
  let to=null;
  byId("q").addEventListener("input", e=>{ clearTimeout(to); to=setTimeout(()=>{ state.q=e.target.value.trim(); state.page=1; load(); },250); });
  byId("status").addEventListener("change", e=>{ state.status=e.target.value; state.page=1; load(); });
  byId("d1").addEventListener("change", e=>{ state.d1=e.target.value; state.page=1; load(); });
  byId("d2").addEventListener("change", e=>{ state.d2=e.target.value; state.page=1; load(); });
  byId("prev").addEventListener("click", ()=>{ if(state.page>1){ state.page--; load(); }});
  byId("next").addEventListener("click", ()=>{ if(state.page*state.pageSize<state.total){ state.page++; load(); }});
  byId("btnNew").addEventListener("click", newOrder);
  byId("btnExport").addEventListener("click", exportCSV);
}

async function newOrder(){
  // cria pedido rascunho
  const { data, error } = await supabase.from("orders").insert({ status:"pending" }).select().single();
  if (error){ toast("Erro ao criar pedido.", "error"); return; }
  openOrder(data.id);
}

function exportCSV(){
  const trs = [...byId("rows").querySelectorAll("tr")];
  const rows = trs.map(tr=>{
    const t = [...tr.querySelectorAll("td")].map(td=> td.innerText);
    return [t[0],t[1],t[2],t[3],t[4],t[5]];
  });
  const header = ["Nº","Cliente","Status","Itens","Total","Atualizado"];
  import("../lib/helpers.js").then(({ downloadCSV })=> downloadCSV("pedidos.csv", [header, ...rows]));
}

function handleRowAction(act,id){
  if (act==="view") openOrder(id);
  if (act==="status") changeStatus(id);
}

async function changeStatus(id){
  const status = prompt("Novo status: pending, processing, paid, shipped, delivered, canceled");
  if (!status) return;
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  error ? toast("Erro ao alterar status.", "error") : (toast("Status atualizado.", "success"), load());
}

async function openOrder(id){
  byId("ordTitle").textContent = `Pedido #${id}`;
  byId("mdlOrder").classList.add("open");
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();
  if (error){ byId("ordBody").innerHTML = "Erro ao carregar pedido."; return; }
  const { data: items } = await supabase.from("order_items").select("id,product_id,sku,title,qty,unit_cents,subtotal_cents").eq("order_id", id);
  renderOrder(order, items||[]);
}

function renderOrder(o, items){
  const sum = (items||[]).reduce((a,b)=> a+(b.subtotal_cents||0), 0);
  const ship = o.shipping_cents||0, disc = o.discount_cents||0;
  const total = sum + ship - disc;

  byId("ordBody").innerHTML = `
    <div class="grid cols-2">
      <div>
        <div class="form-row">
          <div class="col-12"><label>Cliente (e-mail)</label><input id="ord_email" class="input" value="${o.customer_email||""}" placeholder="cliente@email.com"></div>
        </div>
        <div class="form-row">
          <div class="col-6"><label>Telefone</label><input id="ord_phone" class="input" value="${o.customer_phone||""}"></div>
          <div class="col-6"><label>Status</label>
            <select id="ord_status" class="input">
              ${["pending","processing","paid","shipped","delivered","canceled"].map(s=> `<option value="${s}" ${o.status===s?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="col-6"><label>Frete (centavos)</label><input id="ord_ship" class="input" type="number" value="${ship}"></div>
          <div class="col-6"><label>Desconto (centavos)</label><input id="ord_disc" class="input" type="number" value="${disc}"></div>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:8px">
          <button class="btn secondary" id="btnSaveOrder">Salvar Pedido</button>
          <button class="btn ghost" id="btnPrint">Imprimir</button>
        </div>
      </div>

      <div>
        <div style="display:flex; gap:8px; margin-bottom:8px">
          <input class="input" id="addSKU" placeholder="SKU para adicionar">
          <input class="input" id="addQTY" type="number" min="1" value="1" style="max-width:120px">
          <button class="btn" id="btnAddItem">Adicionar</button>
        </div>
        <table class="table" id="tblItems">
          <thead><tr><th>SKU</th><th>Título</th><th class="text-right">Qtd</th><th class="text-right">Unit</th><th class="text-right">Subtotal</th><th class="text-right">Ações</th></tr></thead>
          <tbody>${items.map(it=> rowItem(it)).join("")}</tbody>
        </table>
        <div style="display:flex; justify-content:flex-end; margin-top:8px">
          <div class="badge">Total: <b>${toBRL(total)}</b></div>
        </div>
      </div>
    </div>
  `;

  byId("btnSaveOrder").onclick = ()=> saveOrder(o.id);
  byId("btnAddItem").onclick = ()=> addItem(o.id);
  byId("btnPrint").onclick = ()=> printOrder(o.id);
  byId("tblItems").querySelectorAll("button[data-act='del']").forEach(btn=>{
    btn.addEventListener("click", ()=> delItem(o.id, btn.dataset.id));
  });
}

function rowItem(it){
  return `<tr class="row"><td>${it.sku}</td><td>${it.title||"—"}</td><td class="text-right">${it.qty}</td><td class="text-right">${toBRL(it.unit_cents||0)}</td><td class="text-right">${toBRL(it.subtotal_cents||0)}</td><td class="text-right"><button class="btn ghost" data-act="del" data-id="${it.id}">Remover</button></td></tr>`;
}

async function saveOrder(id){
  const payload = {
    customer_email: byId("ord_email").value.trim() || null,
    customer_phone: byId("ord_phone").value.trim() || null,
    status: byId("ord_status").value,
    shipping_cents: Number(byId("ord_ship").value||0),
    discount_cents: Number(byId("ord_disc").value||0)
  };
  const { error } = await supabase.from("orders").update(payload).eq("id", id);
  error ? toast("Erro ao salvar.", "error") : toast("Pedido salvo.", "success");
  load();
}

async function addItem(orderId){
  const sku = byId("addSKU").value.trim();
  const qty = Number(byId("addQTY").value||1);
  if (!sku || qty<=0){ toast("Informe SKU e quantidade.", "error"); return; }
  const { data: p } = await supabase.from("products").select("id,sku,title,price_cents").eq("sku", sku).single();
  if (!p){ toast("Produto não encontrado.", "error"); return; }
  const subtotal = (p.price_cents||0) * qty;
  const payload = { order_id: orderId, product_id: p.id, sku: p.sku, title: p.title, qty, unit_cents: p.price_cents||0, subtotal_cents: subtotal };
  const { error } = await supabase.from("order_items").insert(payload);
  if (error){ toast("Erro ao adicionar item.", "error"); return; }
  // baixa de estoque
  await supabase.from("inventory_movements").insert({ product_id: p.id, delta: -qty, reason:"order_fulfillment" });
  const { data: inv } = await supabase.from("inventory").select("qty").eq("product_id", p.id).single();
  if (inv) await supabase.from("inventory").update({ qty: (inv.qty||0) - qty }).eq("product_id", p.id);
  openOrder(orderId);
}

async function delItem(orderId, itemId){
  // recuperar item para reverter estoque
  const { data: it } = await supabase.from("order_items").select("*").eq("id", itemId).single();
  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error){ toast("Erro ao remover item.", "error"); return; }
  if (it?.product_id && it?.qty){
    await supabase.from("inventory_movements").insert({ product_id: it.product_id, delta: it.qty, reason:"return" });
    const { data: inv } = await supabase.from("inventory").select("qty").eq("product_id", it.product_id).single();
    if (inv) await supabase.from("inventory").update({ qty: (inv.qty||0) + it.qty }).eq("product_id", it.product_id);
  }
  openOrder(orderId);
}

function printOrder(id){
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Pedido #${id}</title><style>
    body{font-family:Arial, sans-serif; padding:20px}
    table{width:100%; border-collapse:collapse} th,td{border:1px solid #ddd; padding:6px; text-align:left}
  </style></head><body><h2>Pedido #${id}</h2><p>Imprima este comprovante para o cliente.</p></body></html>`);
  w.document.close(); w.focus(); w.print(); w.close();
}

export function init(){
  bindToolbar(); load();
}
window.VS_ORDERS = { init, load };
