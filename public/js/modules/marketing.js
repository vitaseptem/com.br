import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { toBRL, downloadCSV } from "../lib/helpers.js";

function byId(id){return document.getElementById(id);}

function cRow(c){
  const v = c.type==="percentage" ? `${c.value}%` : toBRL(c.value*100); // value em % ou R$
  return `<tr class="row">
    <td>${c.code}</td><td>${c.type}</td><td>${v}</td><td>${c.is_active?"Sim":"Não"}</td>
    <td class="text-right">
      <button class="btn secondary" data-id="${c.id}" data-act="edit">Editar</button>
      <button class="btn ghost" data-id="${c.id}" data-act="del">Apagar</button>
    </td>
  </tr>`;
}

async function loadCoupons(){
  const { data, error } = await supabase.from("coupons").select("*").order("created_at",{ascending:false});
  if (error){ toast("Erro ao listar cupons.","error"); return; }
  byId("cRows").innerHTML = (data||[]).map(cRow).join("");
  byId("cRows").querySelectorAll("button[data-act]").forEach(b=>{
    const id=b.dataset.id, act=b.dataset.act;
    b.onclick = ()=> (act==="edit"?openCoupon(id):delCoupon(id));
  });
}

async function openCoupon(id=null){
  byId("cTitle").textContent = id?"Editar Cupom":"Novo Cupom";
  byId("c_id").value = id||"";
  if (id){
    const { data } = await supabase.from("coupons").select("*").eq("id", id).single();
    byId("c_code").value = data.code;
    byId("c_type").value = data.type;
    byId("c_value").value = data.value;
    byId("c_start").value = data.starts_at?.substring(0,10)||"";
    byId("c_end").value = data.ends_at?.substring(0,10)||"";
    byId("c_min").value = data.min_order_cents||0;
    byId("c_active").value = data.is_active?"true":"false";
  }else{
    ["c_code","c_value","c_min","c_start","c_end"].forEach(id=> byId(id).value="");
    byId("c_type").value="percentage"; byId("c_active").value="true";
  }
  document.getElementById("mdlCoupon").classList.add("open");
}

async function saveCoupon(e){
  e.preventDefault();
  const id = byId("c_id").value||null;
  const p = {
    code: byId("c_code").value.trim(),
    type: byId("c_type").value,
    value: Number(byId("c_value").value||0),
    starts_at: byId("c_start").value? new Date(byId("c_start").value).toISOString(): null,
    ends_at: byId("c_end").value? new Date(byId("c_end").value).toISOString(): null,
    min_order_cents: Number(byId("c_min").value||0),
    is_active: byId("c_active").value==="true"
  };
  let res; if (id) res = await supabase.from("coupons").update(p).eq("id", id); else res = await supabase.from("coupons").insert(p);
  res.error ? toast("Erro ao salvar.","error") : (toast("Cupom salvo.","success"), document.getElementById("mdlCoupon").classList.remove("open"), loadCoupons());
}

async function delCoupon(id){
  if(!confirm("Apagar cupom?")) return;
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  error ? toast("Erro ao apagar.","error") : (toast("Removido.","success"), loadCoupons());
}

async function loadCampaigns(){
  const prov = byId("prov").value, q = (byId("campQ").value||"").toLowerCase();
  // view ad_insights_30d com spend/revenue (ou fallback: ad_insights_daily + orders atrib.)
  let { data, error } = await supabase.from("ad_insights_30d").select("*");
  if (error || !data){
    const [{ data: ads }, { data: ord }] = await Promise.all([
      supabase.from("ad_insights_daily").select("*").gte("date", new Date(Date.now()-29*24*3600*1000).toISOString()),
      supabase.from("orders").select("id,total_cents,campaign_id,created_at").gte("created_at", new Date(Date.now()-29*24*3600*1000).toISOString())
    ]);
    const revenueByCamp = {};
    (ord||[]).forEach(o=> { if(!o.campaign_id) return; revenueByCamp[o.campaign_id]=(revenueByCamp[o.campaign_id]||0)+(o.total_cents||0); });
    const tmp = {};
    (ads||[]).forEach(a=>{
      const k = a.campaign_id;
      const t = tmp[k] || { campaign_name:a.campaign_name, provider:a.provider, spend_cents:0, revenue_cents:0 };
      t.spend_cents += (a.spend_cents||0);
      t.revenue_cents = revenueByCamp[k]||0;
      tmp[k]=t;
    });
    data = Object.values(tmp);
  }
  if (prov) data = data.filter(x=> x.provider===prov);
  if (q) data = data.filter(x=> (x.campaign_name||"").toLowerCase().includes(q));
  byId("campRows").innerHTML = (data||[]).map(r=>{
    const roi = r.spend_cents ? ((r.revenue_cents||0)/r.spend_cents).toFixed(2) : "—";
    return `<tr class="row"><td>${r.campaign_name||r.campaign_id}</td><td>${r.provider}</td><td class="text-right">${toBRL(r.spend_cents||0)}</td><td class="text-right">${toBRL(r.revenue_cents||0)}</td><td class="text-right">${roi}</td></tr>`;
  }).join("");
}

export function init(){
  document.getElementById("btnNewC").onclick = ()=> openCoupon();
  document.getElementById("btnExportC").onclick = async ()=>{
    const { data } = await supabase.from("coupons").select("*");
    const rows = (data||[]).map(c=> [c.code,c.type,c.value,c.is_active]);
    downloadCSV("cupons.csv",[["Código","Tipo","Valor","Ativo"],...rows]);
  };
  document.getElementById("btnCancelC").onclick = ()=> document.getElementById("mdlCoupon").classList.remove("open");
  document.getElementById("frmCoupon").onsubmit = saveCoupon;

  ["prov","campQ"].forEach(id=> document.getElementById(id).addEventListener("input", loadCampaigns));

  loadCoupons(); loadCampaigns();
}
window.VS_MARKETING = { init };
