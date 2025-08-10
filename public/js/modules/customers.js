// Customers (CRM): listagem com busca/filtro/paginação, CRUD, CSV, segmentos e pontos de fidelidade.
import { supabase } from "../lib/supabaseClient.js";
import { toast, setLoading } from "../lib/ui.js";
import { toBRL, formatDate, downloadCSV, maskPhone } from "../lib/helpers.js";

const state = {
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  segment: "",
  loading: false
};

function byId(id){ return document.getElementById(id); }

function rowTemplate(c){
  const last = c.last_order_at ? formatDate(c.last_order_at) : "—";
  const seg = c.seg_label || (c.is_vip ? "VIP" : (c.inativo_90 ? "Inativo 90d" : "—"));
  return `
    <tr class="row">
      <td>${c.name||"—"}</td>
      <td>${c.email||"—"}</td>
      <td>${c.phone||"—"}</td>
      <td class="text-right">${c.orders_count||0}</td>
      <td class="text-right">${toBRL(c.ltv_cents||0)}</td>
      <td>${last}</td>
      <td>${seg}</td>
      <td class="text-right">
        <button class="btn ghost" data-act="points" data-id="${c.id}">+Pontos</button>
        <button class="btn secondary" data-act="edit" data-id="${c.id}">Editar</button>
        <button class="btn ghost" data-act="vip" data-id="${c.id}">VIP</button>
        <button class="btn ghost" data-act="del" data-id="${c.id}">Apagar</button>
      </td>
    </tr>
  `;
}

async function query(){
  const from = supabase.from("customers_view"); // view agregada (SQL final). Fallback abaixo.
  let builder = from.select("*", { count: "exact" });

  if (state.q) {
    builder = builder.ilike("search", `%${state.q}%`); // campo 'search' na view (concat name/email/phone)
  }
  if (state.segment === "vip") builder = builder.eq("is_vip", true);
  if (state.segment === "inativos90") builder = builder.eq("inativo_90", true);

  builder = builder.order("last_order_at", { ascending:false })
                   .range((state.page-1)*state.pageSize, state.page*state.pageSize - 1);

  let { data, error, count } = await builder;
  if (error) {
    console.warn("customers_view indisponível, fallback direto nas tabelas:", error.message);
    // Fallback: junta no cliente (menos performático)
    const q = state.q?.trim() || "";
    const base = supabase.from("customers").select("id,name,email,phone,last_order_at,loyalty_points", { count:"exact" })
      .order("updated_at", { ascending:false })
      .range((state.page-1)*state.pageSize, state.page*state.pageSize - 1);

    let res = q ? await base.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`) : await base;
    if (res.error){ toast("Erro ao consultar clientes.", "error"); return { rows:[], total:0 }; }

    count = res.count || 0;
    const rows = res.data || [];

    // agrega pedidos + LTV
    const ids = rows.map(r=> r.id);
    let stats = {};
    if (ids.length){
      const { data: s } = await supabase.from("orders").select("customer_id,total_cents,created_at,status").in("customer_id", ids);
      (s||[]).forEach(o=>{
        const k = o.customer_id;
        const t = stats[k] || { orders_count:0, ltv_cents:0, last_order_at:null };
        if (o.status === "paid") {
          t.orders_count += 1;
          t.ltv_cents += o.total_cents||0;
          if (!t.last_order_at || new Date(o.created_at) > new Date(t.last_order_at)) t.last_order_at = o.created_at;
        }
        stats[k] = t;
      });
    }
    const now90 = Date.now() - 90*24*3600*1000;
    const merged = rows.map(r=>{
      const s = stats[r.id] || {};
      const last = s.last_order_at || r.last_order_at || null;
      return {
        id: r.id, name: r.name, email: r.email, phone: r.phone,
        orders_count: s.orders_count||0, ltv_cents: s.ltv_cents||0,
        last_order_at: last,
        is_vip: false, // sem view de segmento aqui
        inativo_90: last ? (new Date(last).getTime() < now90) : true,
        seg_label: null
      };
    });
    return { rows: merged, total: count };
  }

  return { rows: data||[], total: count||0 };
}

function render(rows){
  const tbody = byId("rows");
  tbody.innerHTML = rows.map(rowTemplate).join("");
  tbody.querySelectorAll("button[data-act]").forEach(btn=>{
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    btn.addEventListener("click", ()=> handleRowAction(act, id));
  });
  byId("pagingInfo").textContent = `Página ${state.page} • ${state.total} clientes`;
}

async function load(){
  if (state.loading) return;
  state.loading = true;
  const { rows, total } = await query();
  state.total = total;
  render(rows);
  state.loading = false;
}

function bindToolbar(){
  const inp = byId("q");
  let to=null;
  inp.addEventListener("input", ()=>{
    clearTimeout(to);
    to = setTimeout(()=>{ state.q = inp.value.trim(); state.page=1; load(); }, 250);
  });

  byId("seg").addEventListener("change", e=>{
    state.segment = e.target.value;
    state.page = 1; load();
  });

  byId("prev").addEventListener("click", ()=>{
    if (state.page>1){ state.page--; load(); }
  });
  byId("next").addEventListener("click", ()=>{
    if (state.page*state.pageSize < state.total){ state.page++; load(); }
  });

  byId("btnNew").addEventListener("click", newCustomer);
  byId("btnImport").addEventListener("click", ()=> byId("mdlImport").classList.add("open"));
  byId("btnExport").addEventListener("click", exportCSV);

  // Import CSV
  byId("btnDoImport").addEventListener("click", importCSV);
}

function newCustomer(){
  byId("mdlTitle").textContent = "Novo Cliente";
  byId("cust_id").value = "";
  byId("cust_name").value = "";
  byId("cust_email").value = "";
  byId("cust_phone").value = "";
  byId("cust_doc").value = "";
  byId("cust_notes").value = "";
  byId("mdlCustomer").classList.add("open");
}

async function editCustomer(id){
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error){ toast("Erro ao carregar cliente.", "error"); return; }
  byId("mdlTitle").textContent = "Editar Cliente";
  byId("cust_id").value = data.id;
  byId("cust_name").value = data.name||"";
  byId("cust_email").value = data.email||"";
  byId("cust_phone").value = data.phone||"";
  byId("cust_doc").value = data.document||"";
  byId("cust_notes").value = data.notes||"";
  byId("mdlCustomer").classList.add("open");
}

async function deleteCustomer(id){
  if (!confirm("Apagar este cliente?")) return;
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error){ toast("Erro ao apagar.", "error"); return; }
  toast("Cliente removido.", "success"); load();
}

async function addVip(id){
  // Se existir tabela de memberships, adiciona; senão, seta flag no customers (campo is_vip, se existir).
  let ok = false;
  // 1) tentar memberships
  const segSlug = "vip";
  const { data: seg } = await supabase.from("customer_segments").select("id").eq("slug", segSlug).maybeSingle();
  if (seg?.id){
    const { error } = await supabase.from("customer_segment_memberships").upsert({ segment_id: seg.id, customer_id: id }, { onConflict:"segment_id,customer_id" });
    ok = !error;
  }
  // 2) fallback flag
  if (!ok){
    const { error } = await supabase.from("customers").update({ is_vip: true }).eq("id", id);
    ok = !error;
  }
  ok ? toast("Marcado como VIP.", "success") : toast("Falha ao marcar VIP.", "error");
  load();
}

async function addPoints(id){
  const qty = Number(prompt("Quantos pontos adicionar? (ex.: 100)"));
  if (!qty || isNaN(qty)) return;
  const { data, error } = await supabase.from("customers").select("loyalty_points").eq("id", id).single();
  if (error){ toast("Erro ao ler pontos.", "error"); return; }
  const newPts = (data?.loyalty_points||0) + qty;
  const { error: e2 } = await supabase.from("customers").update({ loyalty_points: newPts }).eq("id", id);
  if (e2){ toast("Erro ao salvar pontos.", "error"); return; }
  toast("Pontos adicionados.", "success"); load();
}

function handleRowAction(act, id){
  if (act==="edit") editCustomer(id);
  if (act==="del") deleteCustomer(id);
  if (act==="vip") addVip(id);
  if (act==="points") addPoints(id);
}

function bindForm(){
  byId("cust_phone").addEventListener("input", e=> e.target.value = maskPhone(e.target.value));
  byId("btnCancel").addEventListener("click", ()=> byId("mdlCustomer").classList.remove("open"));

  byId("frmCustomer").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = byId("btnSave");
    setLoading(btn, true);
    try{
      const id = byId("cust_id").value || null;
      const payload = {
        name: byId("cust_name").value.trim(),
        email: byId("cust_email").value.trim(),
        phone: byId("cust_phone").value.trim(),
        document: byId("cust_doc").value.trim(),
        notes: byId("cust_notes").value.trim()
      };
      if (!payload.name){ toast("Nome é obrigatório.", "error"); return; }

      let res;
      if (id){
        res = await supabase.from("customers").update(payload).eq("id", id).select().single();
      } else {
        res = await supabase.from("customers").insert(payload).select().single();
      }
      if (res.error) throw res.error;

      toast("Cliente salvo.", "success");
      byId("mdlCustomer").classList.remove("open");
      load();
    } catch(err){
      console.error(err); toast("Erro ao salvar cliente.", "error");
    } finally {
      setLoading(btn, false);
    }
  });
}

async function importCSV(){
  const file = byId("csvFile").files?.[0];
  if(!file){ toast("Selecione um arquivo CSV.", "error"); return; }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map(s=> s.trim().toLowerCase());
  const cols = ["name","email","phone","document","notes"];
  const map = header.map(h=> cols.includes(h) ? h : null);
  let ok=0, fail=0;
  for (const line of lines){
    const vals = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(s=> s.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
    const payload = {};
    map.forEach((c,i)=> { if(c) payload[c] = vals[i]||null; });
    if (!payload.name){ fail++; continue; }
    const { error } = await supabase.from("customers").insert(payload);
    error ? fail++ : ok++;
  }
  toast(`Importação concluída. Sucesso: ${ok}, Falhas: ${fail}`, fail? "error":"success");
  byId("mdlImport").classList.remove("open");
  load();
}

function exportCSV(){
  // exporta a página atual
  const rows = [...byId("rows").querySelectorAll("tr")].map(tr=>{
    const tds = [...tr.querySelectorAll("td")].map(td=> td.innerText);
    return [tds[0],tds[1],tds[2],tds[3],tds[4],tds[5],tds[6]];
  });
  downloadCSV("clientes.csv", [["Nome","E-mail","Telefone","Pedidos","LTV","Última compra","Segmento"], ...rows]);
}

export function init(){
  bindToolbar(); bindForm(); load();
}

window.VS_CUSTOMERS = { init, load };
