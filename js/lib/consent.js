import { supabase } from "./supabaseClient.js";

// simples armazenamento local + tabela 'consents' para auditoria (quando logado)
const KEY = "vs_consent_v1";

export function getConsent(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || { ads:false, analytics:false, functional:true }; }
  catch{ return { ads:false, analytics:false, functional:true }; }
}
export async function setConsent(c){
  localStorage.setItem(KEY, JSON.stringify(c));
  try{ await supabase.from("consents").insert({ functional:c.functional, analytics:c.analytics, ads:c.ads }); }catch{}
}

export async function showConsentBanner({ force=false }={}){
  // checa setting
  const { data } = await supabase.from("integration_settings").select("key,value").eq("key","consent_on").single();
  if (!force && (data?.value==="false")) return;

  if (document.getElementById("consentBanner")) return;
  const { data: t } = await supabase.from("integration_settings").select("key,value").eq("key","consent_text").single();
  const text = t?.value || "Usamos cookies para melhorar sua experiência.";

  const el = document.createElement("div");
  el.id="consentBanner";
  el.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;background:#141416;border:1px solid rgba(255,255,255,.15);padding:14px;border-radius:12px;z-index:9999;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
  el.innerHTML = `
    <div style="flex:1;min-width:200px">${text}</div>
    <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cAnalytics"> Analytics</label>
    <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cAds"> Ads</label>
    <button class="btn secondary" id="cPrefs">Preferências</button>
    <button class="btn" id="cAccept">Aceitar</button>
  `;
  document.body.appendChild(el);
  const c = getConsent();
  document.getElementById("cAnalytics").checked = c.analytics;
  document.getElementById("cAds").checked = c.ads;

  document.getElementById("cAccept").onclick = async ()=>{
    await setConsent({ functional:true, analytics:document.getElementById("cAnalytics").checked, ads:document.getElementById("cAds").checked });
    el.remove();
    import("./tracking.js").then(m=> m.injectAll());
  };
  document.getElementById("cPrefs").onclick = ()=>{
    alert("Centro de preferências simplificado — futuro: página dedicada com granularidade por provedor.");
  };
}

// auto-exibir em páginas públicas se ainda não definido
if (typeof window!=="undefined" && !localStorage.getItem(KEY)){
  // atrasar para não bloquear render
  setTimeout(()=> showConsentBanner().catch(()=>{}), 800);
}
