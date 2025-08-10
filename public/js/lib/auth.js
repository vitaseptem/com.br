// Auth helpers + guard de páginas
import { supabase } from "./supabaseClient.js";

export async function signInEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpEmailPassword(email, password, meta = {}) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = "/index.html";
    return null;
  }
  return session;
}

// Render foto/nome do usuário no topo (se existir)
export async function renderUserMenu(targetSelector = "#userMenu") {
  const el = document.querySelector(targetSelector);
  if (!el) return;
  const { data: { user } } = await supabase.auth.getUser();
  const name = user?.user_metadata?.name || user?.email || "Usuário";
  el.innerHTML = `
    <div class="badge" style="cursor:default">${name}</div>
    <button class="btn ghost" id="btnLogout">Sair</button>
  `;
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.addEventListener("click", signOut);
}
