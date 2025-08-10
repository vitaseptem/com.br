import { supabase } from "../lib/supabaseClient.js";
import { toast, setLoading } from "../lib/ui.js";
import { downloadCSV, toBRL } from "../lib/helpers.js";

const state = { page:1, pageSize:10, total:0, q:"", cat:"", active:"" };
function byId(id){ return document.getElementById(id); }

function rowTemplate(p){
  return `
    <tr class="row">
      <td>${p.sku}</td>
      <td>${p.title}</td>
      <td>${p.category||"—"}</td>
      <td class="text-right">${toBRL(p.price_cents||0)}</td>
      <td>${p.is_active ? "Sim":"Não"}</td>
      <td class="text-right">
        <button class="btn secondary" data-act="edit" data-id="${p.id}">Editar</button>
        <button class="btn ghost" data-act="del" data-id="${p.id}">Apagar</button>
      </td>
    </tr>
  `;
}

async function loadCategories(){
  const sel = byId("cat");
  const sel2 = byId("prd_category");
  let cats = [];
  const { data, error } = await supabase.from("categories").select("slug,name").order("name");
  if (!error && data) cats = data;
  else cats = [
    { slug:"camisas", name:"Camisas" },
    { slug:"alfaiataria", name:"Alfaiataria" },
    { slug:"basicos", name:"Básicos" },
    { slug:"perfumaria", name:"Perfumes" }
  ]; // fallback

  sel.innerHTML = `<option value="">Todas categorias</option>` + cats.map(c=> `<option value="${c.slug}">${c.name}</option>`).join("");
  sel2.innerHTML = cats.map(c=> `<option value="${c.slug}">${c.name}</option>`).join("");
}

async function query(){
  let builder = supabase.from("products").select("id,sku,title,category,price_cents,is_active,sort_order", { count:"exact" });
  if (state.q) builder = builder.or(`sku.ilike.%${state.q}%,title.ilike.%${state.q}%`);
  if (state.cat) builder = builder.eq("category", state.cat);
  if (state.active !== "") builder = builder.eq("is_active", state.active === "true");
  builder = builder.order("sort_order", { ascending:true }).order("updated_at", { ascending:false })
                   .range((state.page-1)*state.pageSize, state.page*state.pageSize-1);
  const { data, error, count } = await builder;
  if (error){ toast("Erro ao consultar produtos.", "error"); return { rows:[], total:0 }; }
  return { rows: data||[], total: count||0 };
}

function render(rows){
  const tbody = byId("rows");
  tbody.innerHTML = rows.map(rowTemplate).join("");
  tbody.querySelectorAll("button[data-act]").forEach(btn=>{
    const act = btn.dataset.act, id = btn.dataset.id;
    btn.addEventListener("click", ()=> handleRowAction(act, id));
  });
  byId("pagingInfo").textContent = `Página ${state.page} • ${state.total} produtos`;
}

async function load(){
  const { rows, total } = await query();
  state.total = total; render(rows);
}

function bindToolbar(){
  let to=null;
  byId("q").addEventListener("input", e=>{ clearTimeout(to); to=setTimeout(()=>{ state.q=e.target.value.trim(); state.page=1; load(); }, 250); });
  byId("cat").addEventListener("change", e=>{ state.cat=e.target.value; state.page=1; load(); });
  byId("active").addEventListener("change", e=>{ state.active=e.target.value; state.page=1; load(); });
  byId("prev").addEventListener("click", ()=>{ if(state.page>1){ state.page--; load(); }});
  byId("next").addEventListener("click", ()=>{ if(state.page*state.pageSize<state.total){ state.page++; load(); }});

  byId("btnNew").addEventListener("click", newProduct);
  byId("btnImport").addEventListener("click", ()=> byId("mdlImportPrd").classList.add("open"));
  byId("btnDoImportPrd").addEventListener("click", importCSV);
  byId("btnExport").addEventListener("click", exportCSV);
}

function newProduct(){
  byId("prdTitle").textContent = "Novo Produto";
  byId("prd_id").value = "";
  byId("prd_sku").value = "";
  byId("prd_title").value = "";
  byId("prd_category").value = byId("prd_category").querySelector("option")?.value || "";
  byId("prd_price").value = "0";
  byId("prd_compare").value = "";
  byId("prd_badge").value = "";
  byId("prd_active").value = "true";
  byId("prd_sort").value = "100";
  byId("prd_desc").value = "";
  byId("varRows").innerHTML = "";
  byId("imgGrid").innerHTML = "";
  byId("mdlProduct").classList.add("open");
}

async function editProduct(id){
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error){ toast("Erro ao carregar produto.", "error"); return; }
  byId("prdTitle").textContent = `Editar: ${data.title}`;
  byId("prd_id").value = data.id;
  byId("prd_sku").value = data.sku||"";
  byId("prd_title").value = data.title||"";
  byId("prd_category").value = data.category||"";
  byId("prd_price").value = data.price_cents||0;
  byId("prd_compare").value = data.compare_at_cents||"";
  byId("prd_badge").value = data.badge||"";
  byId("prd_active").value = data.is_active ? "true":"false";
  byId("prd_sort").value = data.sort_order||100;
  byId("prd_desc").value = data.description||"";

  // Variantes
  const { data: vars } = await supabase.from("product_variants").select("*").eq("product_id", id).order("sort_order", { ascending:true });
  byId("varRows").innerHTML = (vars||[]).map(v=> varRowTemplate(v)).join("");
  bindVarRowEvents();

  // Imagens
  const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", id).order("sort_order", { ascending:true });
  renderImages(imgs||[]);

  byId("mdlProduct").classList.add("open");
}

function varRowTemplate(v){
  return `
    <tr class="row" data-vid="${v.id||""}">
      <td><input class="input v-sku" value="${v.sku||""}" placeholder="SKU var"></td>
      <td><input class="input v-size" value="${v.size||""}" placeholder="Tamanho"></td>
      <td><input class="input v-color" value="${v.color||""}" placeholder="Cor"></td>
      <td><input class="input v-price" type="number" min="0" value="${v.price_cents||0}"></td>
      <td><input class="input v-bar" value="${v.barcode||""}" placeholder="Código de barras"></td>
      <td class="text-right"><button class="btn ghost v-del">Apagar</button></td>
    </tr>
  `;
}
function bindVarRowEvents(){
  byId("varRows").querySelectorAll(".v-del").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const tr = btn.closest("tr");
      const vid = tr.dataset.vid;
      if (vid){
        const { error } = await supabase.from("product_variants").delete().eq("id", vid);
        if (error){ toast("Erro ao apagar variação.", "error"); return; }
      }
      tr.remove();
    });
  });
}

function addVarRow(){
  const temp = { id:"", sku:"", size:"", color:"", price_cents:0, barcode:"" };
  byId("varRows").insertAdjacentHTML("beforeend", varRowTemplate(temp));
  bindVarRowEvents();
}

function renderImages(imgs){
  const grid = byId("imgGrid");
  grid.innerHTML = imgs.map(im=> `
    <div class="card" style="padding:10px" data-iid="${im.id}">
      <img src="${im.url}" alt="${im.alt||""}" style="width:100%; height:180px; object-fit:cover; border-radius:10px">
      <div class="form-row" style="margin-top:8px">
        <div class="col-6"><input class="input i-alt" placeholder="ALT" value="${im.alt||""}"></div>
        <div class="col-3"><input class="input i-sort" type="number" value="${im.sort_order||100}"></div>
        <div class="col-3"><label style="display:flex; align-items:center; gap:6px"><input type="checkbox" class="i-primary" ${im.is_primary ? "checked":""}> Primária</label></div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px">
        <button class="btn secondary i-save">Salvar</button>
        <button class="btn ghost i-del">Apagar</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".i-save").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const card = btn.closest("[data-iid]");
      const id = card.dataset.iid;
      const alt = card.querySelector(".i-alt").value.trim();
      const sort = Number(card.querySelector(".i-sort").value||100);
      const primary = card.querySelector(".i-primary").checked;
      // se marcar primária, desmarcar outras
      if (primary){
        grid.querySelectorAll(".i-primary").forEach(chk=> chk.checked = (chk===card.querySelector(".i-primary")));
      }
      const { error } = await supabase.from("product_images").update({ alt, sort_order: sort, is_primary: primary }).eq("id", id);
      error ? toast("Erro ao salvar imagem.", "error") : toast("Imagem atualizada.", "success");
    });
  });

  grid.querySelectorAll(".i-del").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if (!confirm("Apagar esta imagem?")) return;
      const id = btn.closest("[data-iid]").dataset.iid;
      const { error } = await supabase.from("product_images").delete().eq("id", id);
      error ? toast("Erro ao apagar imagem.", "error") : (toast("Imagem removida.", "success"), btn.closest("[data-iid]").remove());
    });
  });
}

async function uploadImage(){
  const file = byId("imgFile").files?.[0];
  const pid = byId("prd_id").value;
  if (!pid){ toast("Salve o produto antes de enviar imagens.", "error"); return; }
  if (!file){ toast("Selecione uma imagem.", "error"); return; }
  const ext = file.name.split(".").pop();
  const path = `${pid}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from("products").upload(path, file, { upsert:false });
  if (error){ toast("Upload falhou (verifique o bucket 'products').", "error"); return; }
  // URL pública
  const { data: pub } = supabase.storage.from("products").getPublicUrl(path);
  // insere na tabela
  const { error: e2 } = await supabase.from("product_images").insert({ product_id: pid, url: pub.publicUrl, alt:"", sort_order:100, is_primary:false });
  if (e2){ toast("Erro ao salvar registro da imagem.", "error"); return; }
  const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", pid).order("sort_order", { ascending:true });
  renderImages(imgs||[]);
}

async function saveProduct(e){
  e.preventDefault();
  const btn = byId("btnSavePrd"); setLoading(btn, true);
  try{
    const id = byId("prd_id").value || null;
    const payload = {
      sku: byId("prd_sku").value.trim(),
      title: byId("prd_title").value.trim(),
      category: byId("prd_category").value,
      price_cents: Number(byId("prd_price").value||0),
      compare_at_cents: Number(byId("prd_compare").value||0),
      badge: byId("prd_badge").value.trim() || null,
      is_active: byId("prd_active").value === "true",
      sort_order: Number(byId("prd_sort").value||100),
      description: byId("prd_desc").value.trim() || null
    };
    if (!payload.sku || !payload.title) { toast("SKU e Título são obrigatórios.", "error"); return; }

    let res;
    if (id){
      res = await supabase.from("products").update(payload).eq("id", id).select().single();
    } else {
      res = await supabase.from("products").insert(payload).select().single();
      // cria registro de estoque (se não existir)
      if (!res.error && res.data){
        await supabase.from("inventory").upsert({ product_id: res.data.id, qty: 0, min_qty: 0 }, { onConflict:"product_id" });
      }
    }
    if (res.error) throw res.error;
    const pid = res.data.id;

    // salva variações (apaga as removidas e upsert as presentes)
    const rows = [...byId("varRows").querySelectorAll("tr")];
    const varsPayload = rows.map(tr=> ({
      id: tr.dataset.vid || undefined,
      product_id: pid,
      sku: tr.querySelector(".v-sku").value.trim() || null,
      size: tr.querySelector(".v-size").value.trim() || null,
      color: tr.querySelector(".v-color").value.trim() || null,
      price_cents: Number(tr.querySelector(".v-price").value||0),
      barcode: tr.querySelector(".v-bar").value.trim() || null,
      sort_order: 100
    }));
    // upsert em lote (sem deletar as que não estão listadas — para simplificar)
    for (const vp of varsPayload){
      if (vp.id){
        await supabase.from("product_variants").update(vp).eq("id", vp.id);
      } else {
        await supabase.from("product_variants").insert(vp);
      }
    }

    toast("Produto salvo.", "success");
    byId("mdlProduct").classList.remove("open");
    load();
  }catch(err){
    console.error(err); toast("Erro ao salvar produto.", "error");
  }finally{
    setLoading(btn, false);
  }
}

async function deleteProduct(id){
  if (!confirm("Apagar este produto?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error){ toast("Erro ao apagar.", "error"); return; }
  toast("Produto removido.", "success"); load();
}

function handleRowAction(act, id){
  if (act==="edit") editProduct(id);
  if (act==="del") deleteProduct(id);
}

async function importCSV(){
  const file = byId("prdCSV").files?.[0];
  if(!file){ toast("Selecione um CSV.", "error"); return; }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map(s=> s.trim().toLowerCase());
  const cols = ["sku","title","price_cents","category","description","compare_at_cents","badge","is_active","sort_order"];
  const map = header.map(h=> cols.includes(h) ? h : null);
  let ok=0, fail=0;
  for (const line of lines){
    const vals = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(s=> s.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
    const p = {};
    map.forEach((c,i)=> { if(c) p[c] = vals[i]; });
    if (!p.sku || !p.title){ fail++; continue; }
    const payload = {
      sku:p.sku, title:p.title, category:p.category||null, description:p.description||null, badge:p.badge||null,
      price_cents: Number(p.price_cents||0),
      compare_at_cents: Number(p.compare_at_cents||0),
      is_active: (String(p.is_active||"true").toLowerCase()!=="false"),
      sort_order: Number(p.sort_order||100)
    };
    const { error } = await supabase.from("products").upsert(payload, { onConflict:"sku" });
    error ? fail++ : ok++;
  }
  toast(`Importação: ${ok} OK, ${fail} falhas.`, fail? "error":"success");
  byId("mdlImportPrd").classList.remove("open");
  load();
}

function exportCSV(){
  const trs = [...byId("rows").querySelectorAll("tr")];
  const rows = trs.map(tr=>{
    const t = [...tr.querySelectorAll("td")].map(td=> td.innerText);
    return [t[0],t[1],t[2],t[3],t[4]];
  });
  downloadCSV("produtos.csv", [["SKU","Título","Categoria","Preço","Ativo"], ...rows]);
}

export function init(){
  loadCategories(); bindToolbar();
  byId("btnCancelPrd").addEventListener("click", ()=> byId("mdlProduct").classList.remove("open"));
  byId("frmProduct").addEventListener("submit", saveProduct);
  byId("btnAddVar").addEventListener("click", addVarRow);
  byId("btnUploadImg").addEventListener("click", uploadImage);
  load();
}
window.VS_PRODUCTS = { init, load };
