/* LP360 Website Template Engine v1 - structural templates, not color-only themes */
(() => {
  'use strict';
  const SITE_ID = "TAMBOL";
  const SITE_LABEL = "เว็บไซต์ตำบล";
  const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || (window.SiteFast && window.SiteFast.API_URL) || "https://script.google.com/macros/s/AKfycby7DjChYbHHeFr2aiPFzORgzGpTcsWmkyo80g7RXc3Vfmn7rV7lN5QhORBAgQpSNRmg/exec";
  const STORAGE_KEY = 'LP360:' + SITE_ID + ':template:v1';
  const STORAGE_TIME_KEY = STORAGE_KEY + ':checkedAt';
  const REMOTE_TTL = 5 * 60 * 1000;
  const ADMIN_TOKEN_KEY = "LP360:TAMBOL:mysiteAdminToken";
  const DEFAULT_TEMPLATE = 'education';
  const TEMPLATES = [{"id": "adventure", "name": "Adventure / Travel", "desc": "Hero เต็มภาพ เมนูโปร่ง และแกลเลอรีเด่น"}, {"id": "studio", "name": "Dark Studio", "desc": "โทนเข้ม โมเดิร์น Hero ใหญ่ และ section แบบ studio"}, {"id": "creative", "name": "Creative 3D", "desc": "กรอบโค้ง สีสด Hero แบบงานสร้างสรรค์ และ card ใหญ่"}, {"id": "campaign", "name": "Campaign", "desc": "แนวองค์กร/กิจกรรม Hero เต็มความกว้าง และ card แบบแคมเปญ"}, {"id": "education", "name": "Education / Coaching", "desc": "โปร่ง อ่านง่าย เน้นองค์กร การเรียนรู้ และบุคลากร"}];
  const allowed = new Set(TEMPLATES.map(x => x.id));

  function normalize(value) {
    const v = String(value || '').trim().toLowerCase();
    return allowed.has(v) ? v : DEFAULT_TEMPLATE;
  }

  function pageKind() {
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!path || path === 'index.html') return 'home';
    return path.replace(/\.html?$/,'').replace(/[^a-z0-9_-]/g,'') || 'page';
  }

  function decorate() {
    const kind = pageKind();
    document.documentElement.setAttribute('data-template-page', kind);
    if (document.body) {
      document.body.setAttribute('data-template-page', kind);
      document.body.classList.add('lp360-template-active');
      if (kind === 'home') document.body.classList.add('lp360-template-home');
    }
  }

  function apply(template, persist=true) {
    const value = normalize(template);
    document.documentElement.setAttribute('data-site-template', value);
    if (document.body) document.body.setAttribute('data-site-template', value);
    decorate();
    if (persist) { try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {} }
    window.dispatchEvent(new CustomEvent('lp360templatechange', { detail:{siteId:SITE_ID, template:value} }));
    return value;
  }

  function cached() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); } catch (_) { return DEFAULT_TEMPLATE; }
  }

  async function getRemote() {
    const url = new URL(API_URL);
    url.searchParams.set('mode','template');
    url.searchParams.set('_t',Date.now());
    const r = await fetch(url.toString(), {cache:'no-store', credentials:'omit'});
    const j = await r.json();
    if (!r.ok || j.success === false) throw new Error(j.message || 'โหลด Template ไม่สำเร็จ');
    return normalize((j.data || j).template);
  }

  async function saveRemote(template) {
    let token='';
    try { token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (_) {}
    if (!token) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลก่อน');
    const r = await fetch(API_URL, {
      method:'POST', cache:'no-store', credentials:'omit',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({mode:'templateadmin', action:'save', data:{template:normalize(template)}, token})
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j.message || 'บันทึก Template ไม่สำเร็จ');
    return normalize((j.data || {}).template || template);
  }

  function previewMarkup(t,current) {
    return `<label class="lp360-template-choice ${t.id===current?'is-selected':''}" data-template-choice="${t.id}">
      <input type="radio" name="lp360Template" value="${t.id}" ${t.id===current?'checked':''}>
      <div class="lp360-template-preview lp360-preview-${t.id}" aria-hidden="true">
        <span class="pv-nav"></span><span class="pv-hero"></span><span class="pv-title"></span>
        <span class="pv-card pv-card-a"></span><span class="pv-card pv-card-b"></span><span class="pv-card pv-card-c"></span>
      </div>
      <div class="lp360-template-name">${t.name}</div>
      <div class="lp360-template-desc">${t.desc}</div>
    </label>`;
  }

  async function openManager() {
    if (!window.Swal) { alert('ไม่พบ SweetAlert2'); return; }
    const original = document.documentElement.getAttribute('data-site-template') || cached();
    const result = await Swal.fire({
      title:'เลือก Templates Website',
      html:`<div class="lp360-template-intro"><b>${SITE_LABEL}</b><br>เปลี่ยนโครงสร้างหน้าเว็บ โดยข้อมูล รูปภาพ และฟังก์ชันเดิมยังอยู่ครบ</div><div class="lp360-template-grid">${TEMPLATES.map(t=>previewMarkup(t,original)).join('')}</div>`,
      width:1050, showCancelButton:true, confirmButtonText:'ใช้ Template นี้', cancelButtonText:'ยกเลิก',
      didOpen: popup => {
        popup.querySelectorAll('[data-template-choice]').forEach(el => el.addEventListener('click', () => {
          popup.querySelectorAll('[data-template-choice]').forEach(x => x.classList.remove('is-selected'));
          el.classList.add('is-selected');
          const input=el.querySelector('input'); if(input) input.checked=true;
          apply(el.dataset.templateChoice, false);
        }));
      },
      preConfirm: () => {
        const el=document.querySelector('input[name="lp360Template"]:checked');
        return el ? el.value : original;
      }
    });
    if (!result.isConfirmed) { apply(original,false); return; }
    try {
      Swal.fire({title:'กำลังบันทึก Template...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
      const saved=await saveRemote(result.value);
      apply(saved,true);
      try { localStorage.setItem(STORAGE_TIME_KEY,String(Date.now())); } catch (_) {}
      Swal.fire({icon:'success',title:'เปลี่ยน Template แล้ว',text:'ทุกหน้าของเว็บไซต์จะใช้ '+TEMPLATES.find(x=>x.id===saved).name,timer:1800,showConfirmButton:false});
    } catch(e) {
      apply(original,false);
      Swal.fire({icon:'error',title:'บันทึกไม่สำเร็จ',text:e.message});
    }
  }

  // Apply cached template before DOM ready to reduce layout flash.
  apply(cached(), false);

  const start=async()=>{
    decorate();
    const btn=document.getElementById('templateManagerButton');
    if (btn && !btn.dataset.bound) { btn.addEventListener('click',openManager); btn.dataset.bound='1'; }
    let shouldRefresh=true;
    try {
      const checked=Number(localStorage.getItem(STORAGE_TIME_KEY)||0);
      shouldRefresh=!checked || Date.now()-checked>REMOTE_TTL;
    } catch(_) {}
    if (shouldRefresh) {
      try {
        apply(await getRemote(),true);
        try { localStorage.setItem(STORAGE_TIME_KEY,String(Date.now())); } catch(_) {}
      } catch(e) { console.warn('LP360 template:',e.message); }
    }
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.LP360Template=Object.freeze({SITE_ID,TEMPLATES,apply,getRemote,openManager});
})();
