import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { downloadCSV } from "../lib/helpers.js";

const state={q:"",role:"",active:""};
function byId(id){return document.getElementById(id);}

function rowTemplate(e){
  const last = e.last_login_at ? new Date(e.last_login_at).toLocaleString("pt-BR") : "—";
  return `<tr class="row">
    <td>${e.name||"—"}</td>
    <td>${e.email}</td>
    <td>${e.role}</td>
    <td>${e.is_active?"Sim":"Não"}</td>
    <td>${last}</td>
    <td class="text-right">
      <button class="btn secondary" data-act="edit" data-id="${e.id}">Editar</button>
      <button class="btn ghost" data-act="del" data-id="${e.id}">Apagar</button>
    </td>
  </tr>`;
}

async function load(){
  let b = supabase.from("employees").select("*").order("updated_at",{ascending:false});
  if (state.q) b = b.or(`name.ilike.%${state.q}%,email.ilike.%${state.q}%`);
  if (state.role) b = b.eq("role", state.role);
  if (state.active!=="") b = b.eq("is_active", state.active==="true");
  const { data, error } = await b;
  if (error){ toast("Erro ao listar funcionários.","error"); return; }
  const rows = data||[];
  byId("rows").innerHTML = rows.map(rowTemplate).join("");
  byId("rows").querySelectorAll("button[data-act]").forEach(btn=>{
    const id=btn.dataset.id, act=btn.dataset.act;
    btn.onclick = ()=> (act==="edit"?edit(id):del(id));
  });
}

function bind(){
  let to=null;
  byId("q").oninput = e=>{ clearTimeout(to); to=setTimeout(()=>{state.q=e.target.value.trim(); load();},200); };
  byId("role").onchange = e=>{ state.role=e.target.value; load(); };
  byId("active").onchange = e=>{ state.active=e.target.value; load(); };
  byId("btnNew").onclick = newEmp;
  byId("btnExport").onclick = exportCSV;

  byId("btnCancelEmp").onclick = ()=> byId("mdlEmp").classList.remove("open");
  byId("frmEmp").onsubmit = save;
}

function newEmp(){
  byId("empTitle").textContent="Novo Funcionário";
  byId("emp_id").value="";
  byId("emp_name").value="";
  byId("emp_email").value="";
  byId("emp_role").value="seller";
  byId("emp_active").value="true";
  byId("emp_notes").value="";
  byId("mdlEmp").classList.add("open");
}

async function edit(id){
  const { data, error } = await supabase.from("employees").select("*").eq("id",id).single();
  if (error){ toast("Erro ao carregar.","error"); return; }
  byId("empTitle").textContent="Editar Funcionário";
  byId("emp_id").value=data.id;
  byId("emp_name").value=data.name||"";
  byId("emp_email").value=data.email||"";
  byId("emp_role").value=data.role||"seller";
  byId("emp_active").value=data.is_active?"true":"false";
  byId("emp_notes").value=data.notes||"";
  byId("mdlEmp").classList.add("open");
}

async function del(id){
  if (!confirm("Apagar este funcionário?")) return;
  const { error } = await supabase.from("employees").delete().eq("id", id);
  error ? toast("Erro ao apagar.","error") : (toast("Removido.","success"), load());
}

async function save(e){
  e.preventDefault();
  const id = byId("emp_id").value || null;
  const payload = {
    name: byId("emp_name").value.trim(),
    email: byId("emp_email").value.trim(),
    role: byId("emp_role").value,
    is_active: byId("emp_active").value==="true",
    notes: byId("emp_notes").value.trim()||null
  };
  let res;
  if (id) res = await supabase.from("employees").update(payload).eq("id", id);
  else    res = await supabase.from("employees").insert(payload);
  res.error ? toast("Erro ao salvar.","error") : (toast("Salvo.","success"), byId("mdlEmp").classList.remove("open"), load());
}

function exportCSV(){
  const trs=[...byId("rows").querySelectorAll("tr")];
  const rows=trs.map(tr=>[...tr.querySelectorAll("td")].slice(0,5).map(td=>td.innerText));
  downloadCSV("funcionarios.csv", [["Nome","E-mail","Papel","Ativo","Último acesso"], ...rows]);
}

export function init(){ bind(); load(); }
window.VS_EMPLOYEES = { init };
