// Injeta Sidebar + Topbar em todas as páginas (exceto index.html)
import { renderUserMenu } from "./auth.js";

export function mountLayout(active = "") {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="app">
      <aside>
        <div class="brand"><img src="/assets/logo-mark.svg" alt=""><strong>Vita Septem</strong></div>
        <nav class="nav" aria-label="Menu lateral">
          <div class="group">Principal</div>
          <a href="/dashboard.html" class="${active==='dashboard'?'active':''}">Dashboard</a>
          <a href="/customers.html" class="${active==='customers'?'active':''}">Clientes</a>
          <a href="/suppliers.html" class="${active==='suppliers'?'active':''}">Fornecedores</a>
          <a href="/products.html" class="${active==='products'?'active':''}">Produtos</a>
          <a href="/inventory.html" class="${active==='inventory'?'active':''}">Estoque</a>
          <a href="/orders.html" class="${active==='orders'?'active':''}">Pedidos</a>
          <a href="/pos.html" class="${active==='pos'?'active':''}">PDV</a>
          <div class="group">Operações</div>
          <a href="/employees.html" class="${active==='employees'?'active':''}">Funcionários</a>
          <a href="/time.html" class="${active==='time'?'active':''}">Ponto</a>
          <a href="/finance.html" class="${active==='finance'?'active':''}">Financeiro</a>
          <a href="/marketing.html" class="${active==='marketing'?'active':''}">Marketing</a>
          <a href="/reports.html" class="${active==='reports'?'active':''}">Relatórios</a>
          <a href="/settings.html" class="${active==='settings'?'active':''}">Configurações</a>
        </nav>
      </aside>

      <div>
        <div class="topbar">
          <div style="display:flex; align-items:center; gap:10px">
            <button id="btnOpenDrawer" class="btn ghost" aria-label="Abrir menu" style="display:none">☰</button>
            <span class="badge">Loja atual: <b id="currentStore">Padrão</b></span>
          </div>
          <div class="actions" id="userMenu"></div>
        </div>
        <main>
          <div class="container" id="pageContent"><!-- conteúdo da página --></div>
        </main>
      </div>
    </div>

    <!-- Drawer mobile -->
    <div class="drawer hidden" id="drawer">
      <div class="sheet">
        <div class="brand" style="padding:10px 8px"><img src="/assets/logo-mark.svg" alt=""><strong>Vita Septem</strong></div>
        <nav class="nav">
          <a href="/dashboard.html">Dashboard</a>
          <a href="/customers.html">Clientes</a>
          <a href="/suppliers.html">Fornecedores</a>
          <a href="/products.html">Produtos</a>
          <a href="/inventory.html">Estoque</a>
          <a href="/orders.html">Pedidos</a>
          <a href="/pos.html">PDV</a>
          <a href="/employees.html">Funcionários</a>
          <a href="/time.html">Ponto</a>
          <a href="/finance.html">Financeiro</a>
          <a href="/marketing.html">Marketing</a>
          <a href="/reports.html">Relatórios</a>
          <a href="/settings.html">Configurações</a>
        </nav>
      </div>
    </div>
  `;

  // mobile toggle
  const drawer = document.getElementById("drawer");
  const btn = document.getElementById("btnOpenDrawer");
  if (btn) {
    btn.style.display = window.innerWidth <= 1080 ? "inline-flex" : "none";
    window.addEventListener("resize", ()=> {
      btn.style.display = window.innerWidth <= 1080 ? "inline-flex" : "none";
      if (window.innerWidth > 1080) drawer.classList.add("hidden");
    });
    btn.addEventListener("click", ()=> drawer.classList.toggle("hidden"));
    drawer.addEventListener("click", (e)=> { if (e.target === drawer) drawer.classList.add("hidden"); });
  }

  renderUserMenu("#userMenu");
}
