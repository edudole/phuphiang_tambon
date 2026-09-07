(()=>{
'use strict';
const API=(window.APP_CONFIG&&window.APP_CONFIG.API_URL)||'https://script.google.com/macros/s/AKfycbxba2Enfzaz4wu7supLpkW2V-3aQLk4AG6KtPjc6GczcifG4J7wXpcE85pmAZsoKXdBhg/exec';
const state={items:[],query:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function filtered(){const q=state.query.trim().toLowerCase();if(!q)return state.items;return state.items.filter(x=>`${x.order} ${x.title} ${x.reporter} ${x.type}`.toLowerCase().includes(q));}
function render(){const body=document.getElementById('reportTableBody'),status=document.getElementById('reportStatus');if(!body)return;const items=filtered();status.style.display='none';body.innerHTML=items.map(x=>`<tr><td class="report-order">${esc(x.order)}</td><td>${esc(x.title)}</td><td>${esc(x.reporter)}</td><td class="report-type">${esc(x.type)}</td><td>${x.fileUrl?`<a class="report-download" href="${esc(x.fileUrl)}" target="_blank" rel="noopener noreferrer">ดาวน์โหลด</a>`:'-'}</td></tr>`).join('')||'<tr><td class="report-empty" colspan="5">ยังไม่มีข้อมูลรายงาน</td></tr>';}
async function load(){const status=document.getElementById('reportStatus');if(status){status.style.display='flex';status.innerHTML='<span class="report-spinner" aria-hidden="true"></span><span>กำลังโหลดรายงาน...</span>';}try{const r=await fetch(`${API}?mode=reportitems&_t=${Date.now()}`,{cache:'no-store'}),j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'โหลดข้อมูลไม่สำเร็จ');state.items=Array.isArray(j.items)?j.items:[];render();}catch(e){if(status){status.style.display='block';status.textContent='โหลดรายงานไม่สำเร็จ: '+e.message;}const body=document.getElementById('reportTableBody');if(body)body.innerHTML='';}}
document.getElementById('reportSearch')?.addEventListener('input',e=>{state.query=e.target.value;render();});
document.addEventListener('report-admin-updated',load);
load();
})();
