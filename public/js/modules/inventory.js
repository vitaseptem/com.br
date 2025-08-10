import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { downloadCSV } from "../lib/helpers.js";

const state = { q:"", crit:"", skuFilter:"" };
function byId(id){ return document.getElementById(id); }

function rowTemplate(r){
  return `
    <tr class="row">
      <td>${r.sku}</td>
      <td>${r.title||"—"}</td>
      <td class="text-right">${r.qty||0}</td>
      <td class="text-right">${r.min_qty||0}</td>
      <td class="text-right">
        <button class="btn secondary" data-act="adj" data-id="${r.product_id}">Ajustar</button>
      </td>
    </tr>
  `;
}

async function listInventory(){
  // tenta view inventory_view (SQL final), senão fallback
  let rows = [];
  const { data, error } = await supabase.from("inventory_view").select("*");
  if (!error && data){ rows = data; }
  else {
    const [{ data: inv }, { data: prods }] = await Promise.all([
      supabase.from("inventory").select("*"),
      supabase.from("products").select("id,sku,title")
    ]);
    const map = {}; (prods||[]).forEach(p=> map[p.id]=p);
    rows = (inv||[]).map(i=> ({ product_id: i.product_id, qty: i.qty||0, min_qty: i.min_qty||0, sku: map[i.product_id]?.sku||i.product_id, title: map[i.product_id]?.title||null }));
  }

  // filtros
  const q = state.q.toLowerCase();
  if (q) rows = rows.filter(r=> String(r.sku).toLowerCase().includes(q) || String(r.title||"").toLowerCase().includes(q));
  if (state.crit==="crit") rows = rows.filter(r=> (r.qty||0) <= (r.min_qty||0));

  renderList(rows.slice(0,200));
}

function renderList(rows){
  const tb = byId("rows");
  tb.innerHTML = rows.map(rowTemplate).join("");
  tb.querySelectorAll("button[data-act='adj']").forEach(btn=>{
    btn.addEventListener("click", ()=> openAdjust(btn.dataset.id));
  });
}

function openAdjust(pid){
  byId("adj_product_id").value = pid;
  byId("adj_delta").value = "0";
  byId("adj_reason").value = "manual_adjustment";
  byId("adj_notes").value = "";
  byId("mdlAdjust").classList.add("open");
}

async function doAdjust(e){
  e.preventDefault();
  const pid = byId("adj_product_id").value;
  const delta = Number(byId("adj_delta").value||0);
  const reason = byId("adj_reason").value;
  const notes = byId("adj_notes").value.trim() || null;
  if (!pid || !delta) { toast("Informe a quantidade a ajustar.", "error"); return; }

  // Atualiza inventory e registra movement
  const { data: inv } = await supabase.from("inventory").select("qty").eq("product_id", pid).single();
  const newQty = (inv?.qty||0) + delta;
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("inventory").upsert({ product_id: pid, qty: newQty }, { onConflict:"product_id" }),
    supabase.from("inventory_movements").insert({ product_id: pid, delta, reason, notes })
  ]);
  if (e1 || e2){ toast("Erro ao ajustar.", "error"); return; }
  toast("Estoque atualizado.", "success");
  byId("mdlAdjust").classList.remove("open");
  listInventory(); listMovements();
}

async function listMovements(){
  let builder = supabase.from("inventory_movements_view").select("*").order("created_at", { ascending:false }).limit(200);
  if (state.skuFilter) builder = builder.ilike("sku", `%${state.skuFilter}%`);
  let { data, error } = await builder;
  if (error || !data){
    // fallback join
    const [{ data: mv }, { data: prods }] = await Promise.all([
      supabase.from("inventory_movements").select("*").order("created_at", { ascending:false }).limit(200),
      supabase.from("products").select("id,sku")
    ]);
    const map = {}; (prods||[]).forEach(p=> map[p.id]=p.sku);
    data = (mv||[]).map(m=> ({ created_at:m.created_at, sku: map[m.product_id]||m.product_id, reason:m.reason, delta:m.delta, notes:m.notes||null }));
  }
  renderMovements(data||[]);
}
function renderMovements(rows){
  const tb = byId("mvRows");
  const fmt = (d)=> new Date(d).toLocaleString("pt-BR");
  tb.innerHTML = rows.map(r=> `<tr class="row"><td>${fmt(r.created_at)}</td><td>${r.sku}</td><td>${r.reason}</td><td class="text-right">${r.delta>0?`+${r.delta}`:r.delta}</td><td>${r.notes||"—"}</td></tr>`).join("");
}

async function importCSV(){
  const file = byId("invCSV").files?.[0];
  if(!file){ toast("Selecione o CSV.", "error"); return; }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map(s=> s.trim().toLowerCase());
  const cols = ["sku","qty","min_qty"];
  const map = header.map(h=> cols.includes(h) ? h : null);
  let ok=0, fail=0;
  for (const line of lines){
    const vals = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(s=> s.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
    const r = {}; map.forEach((c,i)=> { if(c) r[c]=vals[i]; });
    if (!r.sku){ fail++; continue; }
    // resolve produto por SKU
    const { data: p } = await supabase.from("products").select("id").eq("sku", r.sku).single();
    if (!p){ fail++; continue; }
    const payload = { product_id: p.id, qty: Number(r.qty||0), min_qty: Number(r.min_qty||0) };
    const { error } = await supabase.from("inventory").upsert(payload, { onConflict:"product_id" });
    error ? fail++ : ok++;
  }
  toast(`Importação de estoque: ${ok} OK, ${fail} falhas.`, fail? "error":"success");
  byId("mdlImportInv").classList.remove("open");
  listInventory();
}

async function exportCSV(){
  // exporta a lista atual (após filtros)
  let rows = [];
  const { data } = await supabase.from("inventory_view").select("*").limit(500);
  if (data) rows = data;
  const csv = [["SKU","Produto","Qtd","Mínimo"], ...rows.map(r=> [r.sku, r.title||"", r.qty||0, r.min_qty||0])];
  downloadCSV("estoque.csv", csv);
}

export function init(){
  byId("q").addEventListener("input", e=>{ state.q=e.target.value.trim(); listInventory(); });
  byId("crit").addEventListener("change", e=>{ state.crit=e.target.value; listInventory(); });
  byId("mvSku").addEventListener("input", e=>{ state.skuFilter=e.target.value.trim(); listMovements(); });
  byId("btnImport").addEventListener("click", ()=> byId("mdlImportInv").classList.add("open"));
  byId("btnExport").addEventListener("click", exportCSV);
  byId("btnDoImportInv").addEventListener("click", importCSV);
  byId("btnCancelAdj").addEventListener("click", ()=> byId("mdlAdjust").classList.remove("open"));
  byId("frmAdjust").addEventListener("submit", doAdjust);

  listInventory(); listMovements();
}
window.VS_INVENTORY = { init };
