(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;

  const fields = {
    userTotal: 'userTotalBox',
    userPrimary: 'userPrimaryBox',
    userMiddle: 'userMiddleBox',
    userHigh: 'userHighBox',
    adminTotal: 'adminTotalBox',
    adminPrimary: 'adminPrimaryBox',
    adminMiddle: 'adminMiddleBox',
    adminHigh: 'adminHighBox',
    registrationCount: 'registrationCountBox',
    loginCount: 'loginCountBox',
    adminLoginCount: 'adminLoginCountBox',
    userLoginCount: 'userLoginCountBox',
    websiteVisitCount: 'websiteVisitCountBox'
  };

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString('th-TH');
  }

  function requestHomeSummaryJsonp() {
    return new Promise((resolve, reject) => {
      if (!API_URL) {
        reject(new Error('ยังไม่ได้กำหนด APP_CONFIG.API_URL'));
        return;
      }

      const callbackName = '__homeSummaryCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let settled = false;

      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('โหลดข้อมูลสรุปใช้เวลานานเกินไป'));
      }, 20000);

      window[callbackName] = result => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        resolve(result || {});
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error('เชื่อมต่อข้อมูลสรุปไม่สำเร็จ'));
      };

      const url = new URL(API_URL);
      url.searchParams.set('mode', 'homesummary');
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('_', Date.now().toString());
      script.src = url.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function loadHomeSummary() {
    const section = document.getElementById('homeSection');
    if (!section) return;

    section.classList.add('home-summary-loading');

    try {
      // ใช้ JSONP เป็นหลักเพื่อไม่ติด CORS ของ Google Apps Script
      const result = await requestHomeSummaryJsonp();
      if (result && result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูลสรุปไม่สำเร็จ');
      }

      const data = (result && result.data) || result || {};
      Object.entries(fields).forEach(([key, id]) => setValue(id, data[key]));
    } catch (error) {
      console.error('loadHomeSummary JSONP error:', error);

      // fallback สำหรับ deployment ที่ยังไม่ส่ง JSONP
      try {
        const result = window.SiteFast
          ? await window.SiteFast.fetchMode('homesummary', {}, { key: '', ttl: 0 })
          : await fetch(`${API_URL}?mode=homesummary&_=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());

        if (result && result.success === false) {
          throw new Error(result.message || 'โหลดข้อมูลสรุปไม่สำเร็จ');
        }

        const data = (result && result.data) || result || {};
        Object.entries(fields).forEach(([key, id]) => setValue(id, data[key]));
      } catch (fallbackError) {
        console.error('loadHomeSummary fallback error:', fallbackError);
      }
    } finally {
      section.classList.remove('home-summary-loading');
    }
  }

  function scheduleHomeSummary() {
    const run = () => loadHomeSummary();
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHomeSummary, { once: true });
  } else {
    scheduleHomeSummary();
  }
})();
