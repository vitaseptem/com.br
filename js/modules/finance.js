import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { toBRL, downloadCSV } from "../lib/helpers.js";

let chart;
function byId(id){return document.getElementById(id);}

async function loadKPIs(){
  // faturamento mês (orders paid)
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  const { data: ord } = await supabase.from("orders").select("total_cents,created_at").eq("status","paid").gte("created_at", start.toISOString());
  const rev = (ord||[]).reduce((a,b)=> a+(b.total_cents||0), 0);
  byId("kpiRev").textContent = toBRL(rev);

  // AR/AP abertos
  const [{ data: ar }, { data: ap }] = await Promise.all([
    supabase.from("accounts_receivable").select("amount_cents,status").eq("status","open"),
    supabase.from("accounts_payable").select("amount_cents,status").eq("status","open")
  ]);
  const sum = (arr)=> (arr||[]).reduce((a,b)=> a+(b.amount_cents||0),0);
  byId("kpiAR").textContent = toBRL(sum(ar));
  byId("kpiAP").textContent = toBRL(sum(ap));
}

function rowTemplate(t){
  const kind = t.kind || (t.table==="accounts_receivable"?"ar":"ap");
  const due = t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—";
  const desc = t.description || "—";
  return `<tr class="row">
    <td>${kind.toUpperCase()}</td>
    <td>${desc}</td>
    <td>${t.cost_center||"—"}</td>
    <td>${due}</td>
    <td>${t.status}</td>
    <td class="text-right">${toBRL(t.amount_cents||0)}</td>
    <td class="text-right">
      <button class="btn secondary" data-act="edit" data-src="${t.table}" data-id="${t.id}">Editar</button>
      <button class="btn ghost" data-act="del" data-src="${t.table}" data-id="${t.id}">Apagar</button>
    </td>
  </tr>`;
}

async function loadList(){
  const kind = byId("kind").value, status = byId("status").value, d1=byId("d1").value, d2=byId("d2").value;
  const make = async (table) => {
    let b = supabase.from(table).select("*, '"+table+"' as table");
    if (status) b = b.eq("status", status);
    if (d1) b = b.gte("due_date", new Date(d1+"T00:00:00").toISOString());
    if (d2) b = b.lte("due_date", new Date(d2+"T23:59:59").toISOString());
    const { data } = await b.order("due_date",{ascending:true});
    return data||[];
  };
  let rows = [];
  if (!kind || kind==="ar") rows = rows.concat(await make("accounts_receivable"));
  if (!kind || kind==="ap") rows = rows.concat(await make("accounts_payable"));
  rows.sort((a,b)=> new Date(a.due_date||a.created_at) - new Date(b.due_date||b.created_at));
  byId("rows").innerHTML = rows.map(rowTemplate).join("");
  byId("rows").querySelectorAll("button[data-act]").forEach(btn=>{
    const id=btn.dataset.id, src=btn.dataset.src, act=btn.dataset.act;
    btn.onclick = ()=> (act==="edit"?openTxn(src,id):delTxn(src,id));
  });
}

async function openTxn(src=null,id=null){
  byId("txnTitle").textContent = id?"Editar Lançamento":"Novo Lançamento";
  byId("txn_id").value = id||"";
  const isAR = src==="accounts_receivable";
  byId("txn_kind").value = isAR? "ar" : "ap";
  if (id){
    const { data } = await supabase.from(src).select("*").eq("id", id).single();
    byId("txn_amount").value = data.amount_cents||0;
    byId("txn_due").value = data.due_date?.substring(0,10)||"";
    byId("txn_cc").value = data.cost_center||"";
    byId("txn_desc").value = data.description||"";
    byId("txn_status").value = data.status||"open";
    byId("txn_paid_at").value = data.paid_at?.substring(0,10)||"";
  }else{
    byId("txn_amount").value = "0";
    byId("txn_due").value = "";
    byId("txn_cc").value = "";
    byId("txn_desc").value = "";
    byId("txn_status").value = "open";
    byId("txn_paid_at").value = "";
  }
  document.getElementById("mdlTxn").classList.add("open");
}

async function saveTxn(e){
  e.preventDefault();
  const kind = byId("txn_kind").value;
  const table = (kind==="ar")? "accounts_receivable" : "accounts_payable";
  const id = byId("txn_id").value || null;
  const payload = {
    amount_cents: Number(byId("txn_amount").value||0),
    due_date: byId("txn_due").value ? new Date(byId("txn_due").value).toISOString() : null,
    cost_center: byId("txn_cc").value.trim()||null,
    description: byId("txn_desc").value.trim()||null,
    status: byId("txn_status").value,
    paid_at: byId("txn_paid_at").value ? new Date(byId("txn_paid_at").value).toISOString() : null
  };
  let res;
  if (id) res = await supabase.from(table).update(payload).eq("id", id);
  else    res = await supabase.from(table).insert(payload);
  res.error ? toast("Erro ao salvar.","error") : (toast("Salvo.","success"), document.getElementById("mdlTxn").classList.remove("open"), loadList(), loadKPIs());
}

async function delTxn(table,id){
  if(!confirm("Apagar este lançamento?")) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  error ? toast("Erro ao apagar.","error") : (toast("Removido.","success"), loadList(), loadKPIs());
}

async function cashChart(){
  const ctx = document.getElementById("cashChart");
  // construir série de 30d: entradas - saídas
  const dToKey = (d)=> d.toISOString().substring(0,10);
  const now = new Date(); const start = new Date(now.getTime()-29*24*3600*1000);
  const keys=[]; for(let i=0;i<30;i++){ const d=new Date(start.getTime()+i*24*3600*1000); keys.push(dToKey(d)); }
  const base = keys.reduce((m,k)=> (m[k]=0,m),{});

  const [{ data: ar }, { data: ap }] = await Promise.all([
    supabase.from("accounts_receivable").select("paid_at,amount_cents,status"),
    supabase.from("accounts_payable").select("paid_at,amount_cents,status")
  ]);
  (ar||[]).forEach(r=>{ const k = r.paid_at? dToKey(new Date(r.paid_at)) : null; if(k && base[k]!==undefined) base[k] += (r.amount_cents||0); });
  (ap||[]).forEach(r=>{ const k = r.paid_at? dToKey(new Date(r.paid_at)) : null; if(k && base[k]!==undefined) base[k] -= (r.amount_cents||0); });

  const labels = keys.map(k=> k.substring(5).split("-").reverse().join("/"));
  const values = keys.map(k=> base[k]/100);

  if (chart) chart.destroy();
  // Chart.js via CDN já importado no theme? Caso não, injetar:
  if (!window.Chart){
    const s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"; await new Promise(r=>{ s.onload=r; document.head.appendChild(s); });
  }
  chart = new Chart(ctx, { type:"line", data:{ labels, datasets:[{label:"Fluxo (R$)", data:values}] }, options:{ responsive:true, plugins:{legend:{display:false}} }});
}

export function init(){
  document.getElementById("btnNew").onclick = ()=> openTxn();
  document.getElementById("btnExport").onclick = async ()=>{
    const [{ data: ar }, { data: ap }] = await Promise.all([
      supabase.from("accounts_receivable").select("*"),
      supabase.from("accounts_payable").select("*")
    ]);
    const rows = [].concat(
      (ar||[]).map(r=>["AR",r.description||"",r.cost_center||"",r.due_date||"",r.status||"",r.amount_cents||0]),
      (ap||[]).map(r=>["AP",r.description||"",r.cost_center||"",r.due_date||"",r.status||"",r.amount_cents||0])
    );
    downloadCSV("financeiro.csv",[["Tipo","Descrição","Centro","Venc.","Status","Valor (cents)"],...rows]);
  };
  ["kind","status","d1","d2"].forEach(id=> document.getElementById(id).onchange = loadList);
  document.getElementById("btnCancelTxn").onclick = ()=> document.getElementById("mdlTxn").classList.remove("open");
  document.getElementById("frmTxn").onsubmit = saveTxn;

  loadKPIs(); loadList(); cashChart();
}
window.VS_FINANCE = { init };
