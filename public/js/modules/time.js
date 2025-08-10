import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";
import { downloadCSV } from "../lib/helpers.js";

function byId(id){return document.getElementById(id);}

function fmt(d){ return new Date(d).toLocaleString("pt-BR"); }
function todayISO(){ const d=new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function endISO(){ const d=new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

async function myPunch(type){
  const { error } = await supabase.from("time_clock").insert({ type });
  error ? toast("Erro ao registrar ponto.","error") : (toast("Ponto registrado.","success"), loadMine(), loadTeam());
}

async function loadMine(){
  const { data, error } = await supabase
    .from("time_clock").select("*")
    .gte("timestamp", todayISO()).lte("timestamp", endISO())
    .order("timestamp",{ascending:true});
  if (error) return;
  const rows = data||[];
  byId("mine").innerHTML = rows.map(r=> `
    <tr class="row">
      <td>${r.type==="in"?"Entrada":"Saída"}</td>
      <td>${fmt(r.timestamp)}</td>
      <td>${r.notes||"—"}</td>
      <td class="text-right">
        <button class="btn ghost" data-id="${r.id}" data-act="edit">Ajustar</button>
      </td>
    </tr>`).join("");
  byId("mine").querySelectorAll("button[data-act='edit']").forEach(b=>{
    b.onclick = ()=> openAdjust(b.dataset.id);
  });
}

async function loadTeam(){
  const q = byId("q")?.value?.trim()||"";
  // view time_today_view agrega entrada/saída e total (fallback abaixo)
  let { data, error } = await supabase.from("time_today_view").select("*");
  if (error || !data){
    // fallback: join básico
    const [{ data: emp }, { data: t }] = await Promise.all([
      supabase.from("employees").select("id,name,email").order("name"),
      supabase.from("time_clock").select("*").gte("timestamp", todayISO()).lte("timestamp", endISO())
    ]);
    const map = {};
    (t||[]).forEach(p=> {
      const m = map[p.user_id] || { in:null, out:null };
      if (p.type==="in" && !m.in) m.in = p.timestamp;
      if (p.type==="out") m.out = p.timestamp;
      map[p.user_id] = m;
    });
    data = (emp||[]).map(e=> {
      const m=map[e.id]||{};
      const hours = (m.in && m.out) ? Math.round((new Date(m.out)-new Date(m.in))/36e5*100)/100 : 0;
      return { name:e.name, email:e.email, first_in:m.in, last_out:m.out, hours };
    });
  }
  if (q) data = data.filter(r=> (r.name||"").toLowerCase().includes(q.toLowerCase()) || (r.email||"").toLowerCase().includes(q.toLowerCase()));
  byId("team").innerHTML = (data||[]).map(r=> `
    <tr class="row">
      <td>${r.name||r.email}</td>
      <td>${r.first_in?fmt(r.first_in):"—"}</td>
      <td>${r.last_out?fmt(r.last_out):"—"}</td>
      <td>${r.hours||0}</td>
      <td class="text-right"><button class="btn ghost" data-mail="${r.email}" data-act="nudge">Avisar</button></td>
    </tr>`).join("");
  byId("team").querySelectorAll('[data-act="nudge"]').forEach(b=>{
    b.onclick = ()=> alert(`Envie um lembrete para ${b.dataset.mail}. (Integração e-mail/WhatsApp na PARTE 8 via /api)`);
  });
}

async function openAdjust(id){
  const { data } = await supabase.from("time_clock").select("*").eq("id", id).single();
  if (!data) return;
  byId("punch_id").value = id;
  byId("punch_type").value = data.type;
  const dt = new Date(data.timestamp);
  const pad = v=> String(v).padStart(2,"0");
  const val = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  byId("punch_at").value = val;
  byId("punch_notes").value = data.notes||"";
  byId("mdlPunch").classList.add("open");
}

async function saveAdjust(e){
  e.preventDefault();
  const id = byId("punch_id").value;
  const type = byId("punch_type").value;
  const at = new Date(byId("punch_at").value).toISOString();
  const notes = byId("punch_notes").value.trim()||null;
  const { error } = await supabase.from("time_clock").update({ type, timestamp: at, notes }).eq("id", id);
  error ? toast("Erro ao ajustar.","error") : (toast("Ajustado.","success"), byId("mdlPunch").classList.remove("open"), loadMine(), loadTeam());
}

export function init(){
  document.getElementById("btnIn").onclick = ()=> myPunch("in");
  document.getElementById("btnOut").onclick = ()=> myPunch("out");
  document.getElementById("btnExport").onclick = async ()=>{
    const { data } = await supabase.from("time_today_view").select("*");
    const rows = (data||[]).map(r=> [r.name||"", r.email||"", r.first_in||"", r.last_out||"", r.hours||0]);
    import("../lib/helpers.js").then(({downloadCSV})=> downloadCSV("ponto_hoje.csv",[["Nome","Email","Entrada","Saída","Horas"], ...rows]));
  };
  document.getElementById("q").oninput = ()=> loadTeam();
  document.getElementById("btnCancelPunch").onclick = ()=> document.getElementById("mdlPunch").classList.remove("open");
  document.getElementById("frmPunch").onsubmit = saveAdjust;

  loadMine(); loadTeam();
}
window.VS_TIME = { init };
