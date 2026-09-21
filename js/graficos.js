// ========================================
// CHARTS
// ========================================
function renderWeekChart(){
  const vals=[820,1050,740,980,1284,1540,900];
  const max=Math.max(...vals);
  const c=document.getElementById('weekChart');
  c.innerHTML=vals.map(v=>`<div class="bar" style="height:${(v/max)*100}%" title="${moneda()} ${v}"></div>`).join('');
}
function renderMonthChart(){
  const vals=Array.from({length:27},()=>Math.floor(600+Math.random()*1200));
  const max=Math.max(...vals);
  const c=document.getElementById('monthChart');
  c.innerHTML=vals.map(v=>`<div class="bar" style="height:${(v/max)*100}%;background:var(--accent);"></div>`).join('');
}

// ========================================
// CONFIG
// ========================================
// showConfig definido más adelante con lógica completa

