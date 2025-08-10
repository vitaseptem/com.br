// Suppliers: lista com filtros/paginação, CRUD, preços por SKU, import/export e comparador por SKU
import { supabase } from "../lib/supabaseClient.js";
import { toast, setLoading } from "../lib/ui.js";
import { downloadCSV } from "../lib/helpers.js";

const state = {
  page: 1, pageSize: 10, total: 0,
  q: "", active: "",
  currentSupplier: null
};

function byId(id){ return document.getElementById(id); }

function rowTemplate(s){
  return `
    <tr class="row">
      <td>${s.name||"—"}</td>
      <td>${s.email||"—"}</td>
      <td>${s.lead_time_days||0}d</td>
      <td>${s.payment_terms||"—"}</td>
      <td>${s.is_active ? "Sim":"Não"}</td>
      <td class="text-right">
        <button class="btn secondary" data-act="edit" data-id="${s.id}">Editar</button>
        <button class="btn ghost" data-act="del" data-id="${s.id}">Apagar</button>
      </td>
    </tr>
  `;
}

async function query(){
  let builder = supabase.from("suppliers").select("*", { count:"exact" });
  if (state.q) builder = builder.ilike("name", `%${state.q}%`);
  if (state.active !== "") builder = builder.eq("is_active", state.active === "true");
  builder = builder.order("updated_at", { ascending:false }).range((state.page-1)*state.pageSize, state.page*state.pageSize-1);
  const { data, error, count } = await builder;
  if (error){ toast("Erro ao consultar fornecedores.", "error"); return { rows:[], total:0 }; }
  return { rows: data||[], total: count||0 };
}

function render(rows){
  const tbody = byId("rows");
  tbody.innerHTML = rows.map(rowTemplate).join("");
  tbody.querySelectorAll("button[data-act]").forEach(btn=>{
    const act = btn.dataset.act, id = btn.dataset.id;
    btn.addEventListener("click", ()=> handleRowAction(act, id));
  });
  byId("pagingInfo").textContent = `Página ${state.page} • ${state.total} fornecedores`;
}

async function load(){
  const { rows, total } = await query();
  state.total = total;
  render(rows);
  // alimenta selects
  await loadSupplierSelects();
}

function bindToolbar(){
  let to=null;
  byId("q").addEventListener("input", e=>{
    clearTimeout(to); to = setTimeout(()=>{ state.q = e.target.value.trim(); state.page=1; load(); }, 250);
  });
  byId("active").addEventListener("change", e=>{
    state.active = e.target.value; state.page=1; load();
  });
  byId("prev").addEventListener("click", ()=>{ if(state.page>1){ state.page--; load(); }});
  byId("next").addEventListener("click", ()=>{ if(state.page*state.pageSize < state.total){ state.page++; load(); }});

  byId("btnNew").addEventListener("click", newSupplier);
  byId("btnImportPrices").addEventListener("click", openImportPrices);
  byId("btnExportSuppliers").addEventListener("click", exportSuppliers);

  // comparador SKU
  byId("btnCmp").addEventListener("click", compareSku);
}

function bindForm(){
  byId("btnCancelSup").addEventListener("click", ()=> byId("mdlSupplier").classList.remove("open"));
  byId("frmSupplier").addEventListener("submit", saveSupplier);
}

function newSupplier(){
  byId("supTitle").textContent = "Novo Fornecedor";
  byId("sup_id").value = "";
  byId("sup_name").value = "";
  byId("sup_email").value = "";
  byId("sup_phone").value = "";
  byId("sup_terms").value = "";
  byId("sup_lead").value = "0";
  byId("sup_active").value = "true";
  byId("sup_notes").value = "";
  byId("mdlSupplier").classList.add("open");
}

async function editSupplier(id){
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
  if (error){ toast("Erro ao carregar fornecedor.", "error"); return; }
  byId("supTitle").textContent = "Editar Fornecedor";
  byId("sup_id").value = data.id;
  byId("sup_name").value = data.name||"";
  byId("sup_email").value = data.email||"";
  byId("sup_phone").value = data.phone||"";
  byId("sup_terms").value = data.payment_terms||"";
  byId("sup_lead").value = data.lead_time_days||0;
  byId("sup_active").value = data.is_active ? "true":"false";
  byId("sup_notes").value = data.notes||"";
  byId("mdlSupplier").classList.add("open");
}

async function deleteSupplier(id){
  if (!confirm("Apagar este fornecedor?")) return;
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error){ toast("Erro ao apagar.", "error"); return; }
  toast("Fornecedor removido.", "success"); load();
}

async function saveSupplier(e){
  e.preventDefault();
  const btn = byId("btnSaveSup"); setLoading(btn, true);
  try{
    const id = byId("sup_id").value || null;
    const payload = {
      name: byId("sup_name").value.trim(),
      email: byId("sup_email").value.trim(),
      phone: byId("sup_phone").value.trim(),
      payment_terms: byId("sup_terms").value.trim(),
      lead_time_days: Number(byId("sup_lead").value||0),
      is_active: byId("sup_active").value === "true",
      notes: byId("sup_notes").value.trim()
    };
    let res;
    if (id) res = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
    else    res = await supabase.from("suppliers").insert(payload).select().single();
    if (res.error) throw res.error;
    toast("Fornecedor salvo.", "success");
    byId("mdlSupplier").classList.remove("open");
    load();
  }catch(err){
    console.error(err); toast("Erro ao salvar fornecedor.", "error");
  }finally{
    setLoading(btn, false);
  }
}

function handleRowAction(act, id){
  if (act==="edit") editSupplier(id);
  if (act==="del") deleteSupplier(id);
}

async function loadSupplierSelects(){
  const { data } = await supabase.from("suppliers").select("id,name").order("name");
  const sel1 = byId("selSupplier");
  const sel2 = byId("selSupPrice");
  [sel1, sel2].forEach(sel=>{
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">Selecione…</option>` + (data||[]).map(s=> `<option value="${s.id}">${s.name}</option>`).join("");
    if (cur) sel.value = cur;
  });

  // bind para carregar preços de um fornecedor
  if (sel1 && !sel1.dataset.bound){
    sel1.dataset.bound = "1";
    sel1.addEventListener("change", ()=> { state.currentSupplier = sel1.value||null; loadPrices(); });
  }
  if (byId("skuSearch") && !byId("skuSearch").dataset.bound){
    byId("skuSearch").dataset.bound="1";
    let to=null;
    byId("skuSearch").addEventListener("input", e=>{
      clearTimeout(to); to = setTimeout(loadPrices, 250);
    });
  }
}

async function loadPrices(){
  const supId = state.currentSupplier;
  const tb = byId("priceRows");
  if (!supId){ tb.innerHTML = `<tr class="row"><td colspan="4">Selecione um fornecedor.</td></tr>`; return; }
  let builder = supabase.from("supplier_prices").select("id,sku,price_cents,moq").eq("supplier_id", supId).order("sku");
  const sku = byId("skuSearch").value.trim();
  if (sku) builder = builder.ilike("sku", `%${sku}%`);
  const { data, error } = await builder;
  if (error){ toast("Erro ao carregar preços.", "error"); return; }
  tb.innerHTML = (data||[]).map(p=> `
    <tr class="row">
      <td>${p.sku}</td>
      <td class="text-right">${p.price_cents}</td>
      <td class="text-right">${p.moq||0}</td>
      <td class="text-right">
        <button class="btn ghost" data-act="del-price" data-id="${p.id}">Apagar</button>
      </td>
    </tr>
  `).join("");
  tb.querySelectorAll('[data-act="del-price"]').forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if (!confirm("Apagar este preço?")) return;
      const { error } = await supabase.from("supplier_prices").delete().eq("id", btn.dataset.id);
      if (error){ toast("Erro ao apagar preço.", "error"); return; }
      toast("Preço removido.", "success"); loadPrices();
    });
  });
}

function openImportPrices(){
  byId("mdlPriceCSV").classList.add("open");
}

async function importPrices(){
  const supId = byId("selSupPrice").value;
  const file = byId("priceCSV").files?.[0];
  if(!supId){ toast("Selecione um fornecedor.", "error"); return; }
  if(!file){ toast("Selecione o CSV.", "error"); return; }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map(s=> s.trim().toLowerCase());
  const cols = ["sku","price_cents","moq"];
  const map = header.map(h=> cols.includes(h) ? h : null);
  let ok=0, fail=0;
  for (const line of lines){
    const vals = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(s=> s.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
    const payload = { supplier_id: supId };
    map.forEach((c,i)=> { if(c) payload[c] = (c==="sku" ? vals[i] : Number(vals[i]||0)); });
    if (!payload.sku){ fail++; continue; }
    const { error } = await supabase.from("supplier_prices").upsert(payload, { onConflict:"supplier_id,sku" });
    error ? fail++ : ok++;
  }
  toast(`Importação concluída. Sucesso: ${ok}, Falhas: ${fail}`, fail? "error":"success");
  byId("mdlPriceCSV").classList.remove("open");
  if (state.currentSupplier === supId) loadPrices();
}

async function compareSku(){
  const sku = byId("cmpSku").value.trim();
  if (!sku){ toast("Informe o SKU.", "error"); return; }
  const { data, error } = await supabase.from("supplier_prices").select("price_cents,moq,supplier_id, suppliers!inner(name)").eq("sku", sku);
  if (error){ toast("Erro ao comparar.", "error"); return; }
  const tbody = byId("cmpRows");
  if (!data?.length){ tbody.innerHTML = `<tr class="row"><td colspan="3">Sem ofertas para este SKU.</td></tr>`; return; }
  const rows = data.sort((a,b)=> (a.price_cents||0) - (b.price_cents||0));
  tbody.innerHTML = rows.map(r=> `<tr class="row"><td>${r.suppliers?.name||r.supplier_id}</td><td class="text-right">${r.price_cents}</td><td class="text-right">${r.moq||0}</td></tr>`).join("");
}

function exportSuppliers(){
  const trs = [...byId("rows").querySelectorAll("tr")];
  const rows = trs.map(tr=> {
    const t = [...tr.querySelectorAll("td")].map(td=> td.innerText);
    return [t[0],t[1],t[2],t[3],t[4]];
  });
  downloadCSV("fornecedores.csv", [["Nome","E-mail","Lead","Pagamento","Ativo"], ...rows]);
}

export function init(){
  bindToolbar(); bindForm();
  byId("btnDoPriceImport").addEventListener("click", importPrices);
  load();
}

window.VS_SUPPLIERS = { init, load };
