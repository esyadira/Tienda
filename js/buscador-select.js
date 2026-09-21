// Searchable select helper
function filterSearchSelect(inputId, dropdownId, options){
  const inp=document.getElementById(inputId);
  const dd=document.getElementById(dropdownId);
  const q=inp.value.toLowerCase();
  const filtered=options.filter(o=>o.toLowerCase().includes(q));
  if(!filtered.length){dd.style.display='none';return;}
  dd.innerHTML=filtered.map(o=>`<div onclick="selectSearchOption('${inputId}','${dropdownId}','${o.replace(/'/g,"\\'")}','${inputId.replace('Input','Val')}')"
    style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);"
    onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">${o}</div>`).join('');
  dd.style.display='block';
}
function selectSearchOption(inputId,dropdownId,val,hiddenId){
  document.getElementById(inputId).value=val;
  document.getElementById(hiddenId).value=val;
  document.getElementById(dropdownId).style.display='none';
}
// Cierra cada dropdown si se hace clic fuera de él y fuera de su propio input de búsqueda
// (clic en cualquier OTRO campo, como Costo, también lo cierra)
const _searchSelectInputs={prodCatDropdown:'prodCatInput',prodProvDropdown:'prodProvInput',clientDropdown:'clientInput'};
document.addEventListener('click',e=>{
  ['prodCatDropdown','prodProvDropdown','clientDropdown'].forEach(id=>{
    const el=document.getElementById(id);
    const inputId=_searchSelectInputs[id];
    if(el&&!e.target.closest('#'+id)&&e.target.id!==inputId)el.style.display='none';
  });
});

