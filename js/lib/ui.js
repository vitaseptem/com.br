// UI utilitários: toasts, confirm, loading, modal open/close
export function toast(msg, type = "info") {
  let holder = document.getElementById("toasts");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "toasts";
    holder.style.position = "fixed";
    holder.style.right = "16px";
    holder.style.bottom = "16px";
    holder.style.display = "grid";
    holder.style.gap = "8px";
    holder.style.zIndex = 9999;
    document.body.appendChild(holder);
  }
  const el = document.createElement("div");
  el.className = "badge";
  el.style.background = type === "error" ? "#5b111f" : (type === "success" ? "#16351d" : "#151517");
  el.style.borderColor = "rgba(255,255,255,.15)";
  el.textContent = msg;
  holder.appendChild(el);
  setTimeout(()=> el.remove(), 3500);
}

export async function confirmBox(message) {
  return new Promise(resolve => {
    const modal = document.createElement("div");
    modal.className = "modal open";
    modal.innerHTML = `
      <div class="box">
        <div class="head"><strong>Confirmação</strong>
          <button class="btn ghost" id="x">Fechar</button>
        </div>
        <div class="body">
          <p style="margin:0 0 12px">${message}</p>
          <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn secondary" id="cancel">Cancelar</button>
            <button class="btn" id="ok">Confirmar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const finish = (val)=>{ modal.remove(); resolve(val); };
    modal.querySelector("#x").onclick = ()=> finish(false);
    modal.querySelector("#cancel").onclick = ()=> finish(false);
    modal.querySelector("#ok").onclick = ()=> finish(true);
    modal.addEventListener("click", e=>{ if(e.target === modal) finish(false); });
  });
}

export function openModal(id){ document.getElementById(id)?.classList.add("open"); }
export function closeModal(id){ document.getElementById(id)?.classList.remove("open"); }

export function setLoading(el, isLoading){
  if(!el) return;
  if(isLoading){
    el.setAttribute("disabled","true");
    el.dataset.prevText = el.textContent;
    el.textContent = "Carregando...";
  } else {
    el.removeAttribute("disabled");
    if(el.dataset.prevText) el.textContent = el.dataset.prevText;
  }
}
