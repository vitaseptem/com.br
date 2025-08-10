import { supabase } from "../lib/supabaseClient.js";
import { toBRL, downloadCSV } from "../lib/helpers.js";
function byId(id){return document.getElementById(id);}

let salesChart, adsChart;

function rangeDates(){
  const d2 = byId("d2").value ? new Date(byId("d2").value) : new Date();
  const d1 = byId("d1").value ? new Date(byId("d1").value) : new Date(d2.getTime()-29*24*3600*1000);
  d1.setHours(0,0,0,0); d2.setHours(23,59,59,999);
  return { d1, d2 };
}

async function loadSales(){
  const { d1, d2 } = rangeDates();
  const { data } = await supabase.from("orders").select("created_at,total_cents").eq("status","paid").gte("created_at", d1.toISOString()).lte("created_at", d2.toISOString());
  const map = {}; for(let t=d1.getTime(); t<=d2.getTime(); t+=86400000){ const d=new Date(t).toISOString().substring(0,10); map[d]=0; }
  (data||[]).forEach(o=> { const d = o.created_at.substring(0,10); if(map[d]!==undefined) map[d]+= (o.total_cents||0); });
  const labels = Object.keys(map);
  const values = labels.map(k=> map[k]/100);
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(byId("salesChart"), { type:"bar", data:{labels, datasets:[{label:"Receita (R$)", data:values}]}, options:{plugins:{legend:{display:false}}} });
}

async function loadAds(){
  const prov = byId("prov").value; const { d1, d2 } = rangeDates();
  let { data, error } = await supabase.from("ad_insights_daily").select("*").gte("date", d1.toISOString()).lte("date", d2.toISOString());
  if (error) data = [];
  if (prov) data = data.filter(r=> r.provider===prov);
  const map = {};
  (data||[]).forEach(r=> {
    const d = r.date.substring(0,10); const m = map[d] || { spend:0, revenue:0 };
    m.spend += (r.spend_cents||0); m.revenue += (r.revenue_cents||0);
    map[d]=m;
  });
  const labels = Object.keys(map).sort();
  const spend = labels.map(k=> (map[k].spend||0)/100);
  const rev = labels.map(k=> (map[k].revenue||0)/100);
  if (adsChart) adsChart.destroy();
  adsChart = new Chart(byId("adsChart"), { type:"line", data:{labels, datasets:[{label:"Spend", data:spend},{label:"Receita", data:rev}]}, options:{responsive:true} });
}

async function loadTop(){
  const { d1, d2 } = rangeDates();
  const { data, error } = await supabase.from("order_items").select("sku,title,qty,subtotal_cents,created_at").gte("created_at", d1.toISOString()).lte("created_at", d2.toISOString());
  if (error) return;
  const map={};
  (data||[]).forEach(i=>{
    const k=i.sku; const t = map[k] || { sku:i.sku, title:i.title, qty:0, rev:0 };
    t.qty += i.qty||0; t.rev += i.subtotal_cents||0; map[k]=t;
  });
  const arr = Object.values(map).sort((a,b)=> b.rev-a.rev).slice(0,50);
  byId("top").innerHTML = arr.map(r=> `<tr class="row"><td>${r.sku}</td><td>${r.title||"—"}</td><td class="text-right">${r.qty}</td><td class="text-right">${toBRL(r.rev)}</td></tr>`).join("");
}

export function init(){
  document.getElementById("btnReload").onclick = ()=> { loadSales(); loadAds(); loadTop(); };
  document.getElementById("btnExport").onclick = async ()=>{
    const { d1,d2 } = rangeDates();
    const [{ data: ord }, { data: ads }] = await Promise.all([
      supabase.from("orders").select("id,total_cents,created_at,status").gte("created_at", d1.toISOString()).lte("created_at", d2.toISOString()),
      supabase.from("ad_insights_daily").select("*").gte("date", d1.toISOString()).lte("date", d2.toISOString())
    ]);
    const rows1 = (ord||[]).map(o=> [o.id,o.status,o.created_at,o.total_cents]);
    const rows2 = (ads||[]).map(a=> [a.provider,a.campaign_name||a.campaign_id,a.date,a.spend_cents,a.revenue_cents]);
    downloadCSV("relatorios.csv", [["Pedidos:id,status,data,total_cents"], ...rows1, [], ["Ads:prov,campanha,data,spend_cents,revenue_cents"], ...rows2]);
  };

  loadSales(); loadAds(); loadTop();
}
window.VS_REPORTS = { init };
