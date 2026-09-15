/* LP360 Theme Engine v1 - เว็บไซต์ตำบล */
(() => {
  'use strict';
  const SITE_ID = 'TAMBOL';
  const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || (window.SiteFast && window.SiteFast.API_URL) || 'https://script.google.com/macros/s/AKfycby7DjChYbHHeFr2aiPFzORgzGpTcsWmkyo80g7RXc3Vfmn7rV7lN5QhORBAgQpSNRmg/exec';
  const STORAGE_KEY = 'LP360:' + SITE_ID + ':theme:v1';
  const STORAGE_TIME_KEY = STORAGE_KEY + ':checkedAt';
  const REMOTE_TTL = 5 * 60 * 1000;
  const ADMIN_TOKEN_KEY = 'LP360:TAMBOL:mysiteAdminToken';
  const DEFAULT_THEME = 'modern';
  const THEMES = [{"id": "modern", "name": "Modern", "desc": "ทันสมัย การ์ดโค้ง สีสด"}, {"id": "government", "name": "Government", "desc": "ทางการ สุภาพ กรมท่า-ทอง"}, {"id": "education", "name": "Education", "desc": "สดใส เป็นมิตรกับการเรียนรู้"}, {"id": "minimal", "name": "Minimal", "desc": "เรียบ อ่านง่าย เอฟเฟกต์น้อย"}, {"id": "premium", "name": "Premium", "desc": "โทนเข้ม ทอง ดูโดดเด่น"}];
  const allowed = new Set(THEMES.map(x => x.id));

  function normalize(value) {
    const v = String(value || '').trim().toLowerCase();
    return allowed.has(v) ? v : DEFAULT_THEME;
  }
  function apply(theme, persist=true) {
    const value = normalize(theme);
    document.documentElement.setAttribute('data-site-theme', value);
    if (document.body) document.body.setAttribute('data-site-theme', value);
    if (persist) { try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {} }
    window.dispatchEvent(new CustomEvent('lp360themechange', { detail: { siteId:SITE_ID, theme:value } }));
    return value;
  }
  function cached() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); } catch (_) { return DEFAULT_THEME; }
  }
  async function getRemote() {
    const url = new URL(API_URL);
    url.searchParams.set('mode','theme');
    url.searchParams.set('_t',Date.now());
    const r = await fetch(url.toString(), { cache:'no-store' });
    const j = await r.json();
    if (!r.ok || j.success === false) throw new Error(j.message || 'โหลดธีมไม่สำเร็จ');
    const data = j.data || j;
    return normalize(data.theme);
  }
  async function saveRemote(theme) {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    if (!token) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลก่อน');
    const r = await fetch(API_URL, {
      method:'POST', cache:'no-store', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({ mode:'themeadmin', action:'save', data:{theme:normalize(theme)}, token })
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j.message || 'บันทึกธีมไม่สำเร็จ');
    return normalize((j.data||{}).theme || theme);
  }
  function cardHtml(t, current) {
    return `<label class="lp360-theme-choice ${t.id===current?'is-selected':''}" data-theme-choice="${t.id}">
      <input type="radio" name="lp360Theme" value="${t.id}" ${t.id===current?'checked':''}>
      <div class="lp360-theme-swatch lp360-swatch-${t.id}"></div>
      <div class="lp360-theme-name">${t.name}</div><div class="lp360-theme-desc">${t.desc}</div>
    </label>`;
  }
  async function openManager() {
    if (!window.Swal) { alert('ไม่พบ SweetAlert2'); return; }
    let current = document.documentElement.getAttribute('data-site-theme') || cached();
    const result = await Swal.fire({
      title:'เลือกธีมเว็บไซต์',
      html:`<div style="font-size:13px;color:#667085">เว็บไซต์ตำบล · ข้อมูลและฟังก์ชันเดิมยังคงอยู่ครบ</div><div class="lp360-theme-grid">${THEMES.map(t=>cardHtml(t,current)).join('')}</div>`,
      width:900, showCancelButton:true, confirmButtonText:'บันทึกธีม', cancelButtonText:'ยกเลิก',
      didOpen: popup => {
        popup.querySelectorAll('[data-theme-choice]').forEach(el => el.addEventListener('click', () => {
          popup.querySelectorAll('[data-theme-choice]').forEach(x => x.classList.remove('is-selected'));
          el.classList.add('is-selected'); const input=el.querySelector('input'); if(input) input.checked=true;
          apply(el.dataset.themeChoice, false);
        }));
      },
      preConfirm: () => { const el=document.querySelector('input[name="lp360Theme"]:checked'); return el ? el.value : current; }
    });
    if (!result.isConfirmed) { apply(current, false); return; }
    try {
      Swal.fire({title:'กำลังบันทึกธีม...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
      const saved = await saveRemote(result.value);
      apply(saved, true);
      try { localStorage.setItem(STORAGE_TIME_KEY, String(Date.now())); } catch (_) {}
      Swal.fire({icon:'success',title:'บันทึกธีมแล้ว',text:'ทุกหน้าของเว็บไซต์จะใช้ธีม '+saved,timer:1500,showConfirmButton:false});
    } catch (e) { apply(current, false); Swal.fire({icon:'error',title:'บันทึกไม่สำเร็จ',text:e.message}); }
  }

  apply(cached(), false);
  const start = async () => {
    if (document.body) document.body.setAttribute('data-site-theme', document.documentElement.getAttribute('data-site-theme') || DEFAULT_THEME);
    const btn=document.getElementById('themeManagerButton');
    if (btn && !btn.dataset.bound) { btn.addEventListener('click', openManager); btn.dataset.bound='1'; }
    let shouldRefresh = true;
    try {
      const checkedAt = Number(localStorage.getItem(STORAGE_TIME_KEY) || 0);
      shouldRefresh = !checkedAt || (Date.now() - checkedAt > REMOTE_TTL);
    } catch (_) {}
    if (shouldRefresh) {
      try {
        apply(await getRemote(), true);
        try { localStorage.setItem(STORAGE_TIME_KEY, String(Date.now())); } catch (_) {}
      } catch (e) { console.warn('LP360 theme:', e.message); }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
  window.LP360Theme = Object.freeze({SITE_ID, THEMES, apply, getRemote, openManager});
})();
