import { supabase } from "../lib/supabaseClient.js";
import { toast } from "../lib/ui.js";

function byId(id){return document.getElementById(id);}

async function loadSettings(){
  const { data } = await supabase.from("integration_settings").select("key,value").in("key",["gtm_id","ga4_id","pixel_id","pixel_match","consent_on","consent_text"]).limit(1000);
  const map={}; (data||[]).forEach(r=> map[r.key]=r.value);
  byId("gtm_id").value = map.gtm_id||"";
  byId("ga4_id").value = map.ga4_id||"";
  byId("pixel_id").value = map.pixel_id||"";
  byId("pixel_match").value = (map.pixel_match==="false")?"false":"true";
  byId("consent_on").value = (map.consent_on==="false")?"false":"true";
  byId("consent_text").value = map.consent_text||"Usamos cookies para melhorar sua experiência.";
}

async function saveKV(key,value){
  const { error } = await supabase.from("integration_settings").upsert({ key, value }, { onConflict:"key" });
  if (error) toast(`Falha ao salvar ${key}.`,"error");
}

export function init(){
  loadSettings();
  byId("btnSaveGA").onclick = async ()=>{ await saveKV("gtm_id", byId("gtm_id").value.trim()); await saveKV("ga4_id", byId("ga4_id").value.trim()); toast("GTM/GA4 salvos.","success"); };
  byId("btnTestGA").onclick = ()=> alert("O teste envia um ping via /api/track/ga4 (configurado na PARTE 8).");

  byId("btnSavePixel").onclick = async ()=>{ await saveKV("pixel_id", byId("pixel_id").value.trim()); await saveKV("pixel_match", byId("pixel_match").value); toast("Pixel salvo.","success"); };
  byId("btnTestPixel").onclick = ()=> alert("O teste envia um PageView via /api/track/meta.");

  byId("btnStripeConnect").onclick = ()=> window.location.href = "/api/integrations/stripe/connect";
  byId("btnStripeLogs").onclick = ()=> window.location.href = "/api/integrations/stripe/logs";
  byId("btnPixConnect").onclick = ()=> window.location.href = "/api/integrations/pix/connect";
  byId("btnPixTest").onclick = ()=> window.location.href = "/api/integrations/pix/test";

  byId("btnConsentSave").onclick = async ()=>{
    await saveKV("consent_on", byId("consent_on").value);
    await saveKV("consent_text", byId("consent_text").value.trim());
    toast("Consentimento salvo.","success");
  };
  byId("btnConsentPreview").onclick = ()=>{
    import("../lib/consent.js").then(({ showConsentBanner })=>{
      showConsentBanner({ force:true });
    });
  };
}
window.VS_SETTINGS = { init };
