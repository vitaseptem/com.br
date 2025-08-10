// Carrega consent e integrações em todas as páginas (exceto index pode usar também, se quiser)
import { ensureConsentBanner } from "./lib/consent.js";
import { initIntegrations } from "./lib/inject-integrations.js";

ensureConsentBanner();
document.addEventListener("vs-consent-changed", initIntegrations);
initIntegrations();
