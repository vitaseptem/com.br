import { supabase } from "./supabaseClient.js";
import { getConsent } from "./consent.js";

let injected=false;

export async function injectAll(){
  if (injected) return; injected=true;
  const { data } = await supabase.from("integration_settings").select("key,value").in("key",["gtm_id","ga4_id","pixel_id","pixel_match"]).limit(1000);
  const map={}; (data||[]).forEach(r=> map[r.key]=r.value);
  const consent = getConsent();

  // GTM (container carrega pixels, mas aqui mantemos também GA4/Pixel nativos se desejar granular)
  if (map.gtm_id && (consent.analytics||consent.ads)){
    const s = document.createElement("script");
    s.async = true; s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(map.gtm_id)}`;
    document.head.appendChild(s);
    const nos = document.createElement("noscript");
    nos.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${map.gtm_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.appendChild(nos);
  }

  // GA4 direto (opcional)
  if (map.ga4_id && consent.analytics){
    const s1 = document.createElement("script"); s1.async=true; s1.src=`https://www.googletagmanager.com/gtag/js?id=${map.ga4_id}`; document.head.appendChild(s1);
    const s2 = document.createElement("script"); s2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('consent', 'default', { ad_user_data: '${consent.ads?"granted":"denied"}', ad_personalization: '${consent.ads?"granted":"denied"}', ad_storage: '${consent.ads?"granted":"denied"}', analytics_storage: '${consent.analytics?"granted":"denied"}' });
      gtag('js', new Date()); gtag('config', '${map.ga4_id}');
    `; document.head.appendChild(s2);
  }

  // Meta Pixel (client-side)
  if (map.pixel_id && consent.ads){
    const s = document.createElement("script"); s.innerHTML = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js'); fbq('init','${map.pixel_id}'); fbq('track','PageView');`; document.head.appendChild(s);
    const nos = document.createElement("noscript"); nos.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${map.pixel_id}&ev=PageView&noscript=1"/>`; document.body.appendChild(nos);
  }
}

// chamar manualmente após login
if (typeof window!=="undefined"){
  window.addEventListener("load", ()=> injectAll().catch(()=>{}));
}
