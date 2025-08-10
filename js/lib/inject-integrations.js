// Injeta GTM / GA4 / Meta Pixel conforme consent + integration_settings (futuro via Supabase)
// Por enquanto, lê IDs públicos de window.ENV.* (pode preencher depois na settings.html)
import { getConsent } from "./consent.js";

function injectScript(src, attrs={}){
  const s = document.createElement("script");
  s.src = src; Object.entries(attrs).forEach(([k,v])=> s.setAttribute(k,v));
  document.head.appendChild(s);
}
function injectInline(code){
  const s = document.createElement("script");
  s.textContent = code;
  document.head.appendChild(s);
}

export function initIntegrations(){
  const consent = getConsent();

  // GTM
  if (window.ENV?.GTM_ID && consent.analytics) {
    injectInline(`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${window.ENV.GTM_ID}');`);
  }

  // GA4
  if (window.ENV?.GA4_MEASUREMENT_ID && consent.analytics) {
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${window.ENV.GA4_MEASUREMENT_ID}`, { async: true });
    injectInline(`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date()); gtag('config', '${window.ENV.GA4_MEASUREMENT_ID}');
    `);
  }

  // Meta Pixel
  if (window.ENV?.META_PIXEL_ID && (consent.ads || consent.analytics)) {
    injectInline(`
      !function(f,b,e,v,n,t,s) {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)}; if(!f._fbq)f._fbq=n;
      n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[]; t=b.createElement(e); t.async=!0;
      t.src=v; s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js'); fbq('init','${window.ENV.META_PIXEL_ID}'); fbq('track','PageView');
    `);
  }
}
