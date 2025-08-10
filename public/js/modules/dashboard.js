// Dashboard: consultas rápidas (sujeito a RLS no Supabase)
// Tabelas esperadas (serão criadas no SQL final):
// orders(id, tenant_id, status, total_cents, created_at)
// order_items(order_id, product_id, qty, subtotal_cents)
// products(id, sku, title)
// inventory(product_id, qty, min_qty)

import { supabase } from "../lib/supabaseClient.js";
import { toBRL } from "../lib/helpers.js";

async function kpiToday(){
  const { data, error } = await supabase
    .from("orders")
    .select("total_cents, created_at")
    .eq("status","paid")
    .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
  if(error) throw error;
  const sum = (data||[]).reduce((a,b)=> a + (b.total_cents||0), 0);
  document.getElementById("kpi-today").textContent = toBRL(sum);
}

async function kpiMonth(){
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  const { data, error } = await supabase
    .from("orders")
    .select("id,total_cents")
    .eq("status","paid")
    .gte("created_at", start.toISOString());
  if(error) throw error;
  const sum = (data||[]).reduce((a,b)=> a + (b.total_cents||0), 0);
  document.getElementById("kpi-month").textContent = toBRL(sum);
  document.getElementById("kpi-orders").textContent = (data||[]).length;
}

async function kpiConversion(){
  // Exemplo simples: pedidos pagos / pedidos criados (mês)
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);

  const [{ count: created }, { count: paid }] = await Promise.all([
    supabase.from("orders").select("id", { count:"exact", head:true }).gte("created_at", start.toISOString()),
    supabase.from("orders").select("id", { count:"exact", head:true }).eq("status","paid").gte("created_at", start.toISOString()),
  ]);
  const conv = created ? ((paid||0)/created*100) : 0;
  document.getElementById("kpi-conv").textContent = `${conv.toFixed(1)}%`;
}

async function chartRevenue(){
  const since = new Date(Date.now()-29*24*3600*1000); since.setHours(0,0,0,0);
  const { data, error } = await supabase
    .rpc("daily_revenue", { since: since.toISOString() }); // função SQL agregadora (enviada no pacote SQL final)
  if(error){ console.warn("fallback sem função RPC:", error.message); }

  let series = [];
  if (data && data.length){
    series = data.map(r=>({ d:r.day, v:r.cents||0 }));
  } else {
    // fallback: agrega no cliente (menos performático)
    const { data: rows } = await supabase
      .from("orders").select("total_cents, created_at").eq("status","paid").gte("created_at", since.toISOString());
    const map = {};
    (rows||[]).forEach(r=>{
      const d = new Date(r.created_at); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      map[key] = (map[key]||0) + (r.total_cents||0);
    });
    series = Object.entries(map).sort((a,b)=> a[0].localeCompare(b[0])).map(([d,v])=>({ d, v }));
  }

  const ctx = document.getElementById("chartRevenue");
  new Chart(ctx, {
    type:"line",
    data:{
      labels: series.map(r=> r.d),
      datasets:[{ label:"Faturamento (R$)", data: series.map(r=> r.v/100) }]
    },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

async function chartOrders(){
  const since = new Date(Date.now()-29*24*3600*1000); since.setHours(0,0,0,0);
  const { data, error } = await supabase.rpc("daily_orders", { since: since.toISOString() });
  if(error){ console.warn("fallback daily_orders:", error.message); }

  let series = [];
  if(data && data.length){
    series = data.map(r=>({ d:r.day, n:r.count||0 }));
  } else {
    const { data: rows } = await supabase
      .from("orders").select("id,created_at").gte("created_at", since.toISOString());
    const map = {};
    (rows||[]).forEach(r=>{
      const d = new Date(r.created_at); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      map[key] = (map[key]||0) + 1;
    });
    series = Object.entries(map).sort((a,b)=> a[0].localeCompare(b[0])).map(([d,n])=>({ d, n }));
  }

  const ctx = document.getElementById("chartOrders");
  new Chart(ctx, {
    type:"bar",
    data:{ labels: series.map(r=> r.d), datasets:[{ label:"Pedidos", data: series.map(r=> r.n) }]},
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

async function topProductsMonth(){
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  // precisa de uma view ou join client-side
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, qty, subtotal_cents, orders!inner(created_at,status)")
    .gte("orders.created_at", start.toISOString())
    .eq("orders.status","paid");

  const agg = new Map();
  (items||[]).forEach(it=>{
    const cur = agg.get(it.product_id) || { qty:0, rev:0 };
    cur.qty += (it.qty||0);
    cur.rev += (it.subtotal_cents||0);
    agg.set(it.product_id, cur);
  });

  const arr = [...agg.entries()].sort((a,b)=> b[1].rev - a[1].rev).slice(0,8);
  // puxa títulos
  const ids = arr.map(([id])=> id);
  let names = {};
  if (ids.length){
    const { data: prods } = await supabase.from("products").select("id, sku, title").in("id", ids);
    (prods||[]).forEach(p=> names[p.id] = p);
  }

  const tbody = document.querySelector("#tblTop tbody");
  tbody.innerHTML = "";
  arr.forEach(([id, v])=>{
    const p = names[id] || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.sku||id}</td><td>${p.title||"—"}</td><td class="text-right">${v.qty}</td><td class="text-right">${toBRL(v.rev)}</td>`;
    tbody.appendChild(tr);
  });
}

async function lowStock(){
  const { data } = await supabase.from("inventory_view_low").select("*").limit(10);
  // caso a view não exista ainda, fallback:
  let rows = data || [];
  if(!rows.length){
    const [{ data: inv }, { data: prods }] = await Promise.all([
      supabase.from("inventory").select("product_id, qty, min_qty"),
      supabase.from("products").select("id, sku, title"),
    ]);
    const names = {}; (prods||[]).forEach(p=> names[p.id]=p);
    rows = (inv||[]).filter(x=> (x.qty||0) <= (x.min_qty||0)).slice(0,10).map(x=>({
      sku: names[x.product_id]?.sku || x.product_id,
      title: names[x.product_id]?.title || "—",
      qty: x.qty||0, min_qty: x.min_qty||0
    }));
  }

  const tbody = document.querySelector("#tblLow tbody");
  tbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.sku}</td><td>${r.title}</td><td class="text-right">${r.qty}</td><td class="text-right">${r.min_qty}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadAll(){
  await Promise.all([
    kpiToday(),
    kpiMonth(),
    kpiConversion(),
    chartRevenue(),
    chartOrders(),
    topProductsMonth(),
    lowStock()
  ]);
}

window.VS_DASHBOARD = { loadAll };
