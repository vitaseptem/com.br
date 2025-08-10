// Helpers: formatos, máscaras, csv
export const toBRL = (cents)=> (Number(cents||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const fromBRL = (str)=> Math.round(Number(String(str).replace(/[^\d]/g,"")) || 0);

export function formatDate(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()}`;
}

export function downloadCSV(filename, rows){
  const process = (row)=> row.map(v=>{
    if(v==null) return "";
    let s = String(v).replace(/"/g,'""');
    if (s.search(/("|,|\n)/g) >= 0) s = `"${s}"`;
    return s;
  }).join(",");
  const csv = rows.map(process).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function maskPhone(v){
  const s = String(v||"").replace(/\D/g,"").slice(0,11);
  if(s.length<=10) return s.replace(/(\d{2})(\d{4})(\d{0,4}).*/,"($1) $2-$3");
  return s.replace(/(\d{2})(\d{5})(\d{0,4}).*/,"($1) $2-$3");
}

export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
