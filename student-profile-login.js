(() => {
  'use strict';

  let isSearching = false;
  let autoSearchTimer = 0;
  let lastAutoRollno = '';

  function showMessage(options) {
    if (window.Swal) return Swal.fire(options);
    window.alert(options.text || options.title || 'เกิดข้อผิดพลาด');
    return Promise.resolve();
  }

  function showSearching(rollno) {
    if (!window.Swal) return;
    Swal.fire({
      title: 'กำลังค้นหาข้อมูลนักศึกษา',
      html: `รหัสนักศึกษา <strong>${escapeHtml(rollno)}</strong><br><small>กรุณารอสักครู่...</small>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setTextColor(element, value) {
    const color = String(value || '').trim();
    if (!element || !color) return;
    try {
      if (window.CSS && CSS.supports && !CSS.supports('color', color)) return;
    } catch (_) {}
    element.style.color = color;
  }

  function applyLoginCardConfig(config) {
    const data = config || {};
    const title = document.getElementById('studentServicesLoginTitle');
    const subtitle = document.getElementById('studentServicesLoginSubtitle');
    const photo = document.getElementById('studentServicesLoginPhoto');
    const logo = document.getElementById('studentServicesLoginLogo');

    if (title && data.title) title.textContent = String(data.title);
    if (subtitle) subtitle.textContent = String(data.subtitle || '');
    setTextColor(title, data.titleColor);
    setTextColor(subtitle, data.subtitleColor);

    if (photo && data.photo) photo.src = String(data.photo);
    if (logo && data.logo) {
      logo.src = String(data.logo);
      logo.hidden = false;
    }
  }

  async function loadLoginCardConfig() {
    try {
      if (!window.SiteFast || typeof window.SiteFast.getHomeFast !== 'function') return;
      const result = await window.SiteFast.getHomeFast();
      const data = result?.data || result || {};
      if (data.studentLogin) applyLoginCardConfig(data.studentLogin);
    } catch (error) {
      console.warn('student login card config:', error);
    }
  }

  function lookupStudentByJsonp(rollno) {
    const webAppUrl = String(window.APP_CONFIG?.API_URL || '').trim();
    if (!webAppUrl) {
      return Promise.reject(new Error('ยังไม่ได้กำหนด URL ของ Apps Script หลักของเว็บไซต์'));
    }

    return new Promise((resolve, reject) => {
      const callbackName = `__sssStudentLookup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeoutMs = 30000;
      let timer = 0;

      const cleanup = () => {
        if (timer) window.clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        script.remove();
      };

      window[callbackName] = payload => {
        cleanup();
        resolve(payload || {});
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('เชื่อมต่อระบบค้นหานักศึกษาไม่สำเร็จ'));
      };

      const url = new URL(webAppUrl);
      url.searchParams.set('mode', 'studentlookup');
      url.searchParams.set('rollno', rollno);
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('_', Date.now().toString());

      script.src = url.toString();
      script.async = true;

      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('ระบบค้นหาใช้เวลานานเกินไป กรุณาลองใหม่'));
      }, timeoutMs);

      document.head.appendChild(script);
    });
  }

  async function searchAndOpenProfile(rollno) {
    if (isSearching) return;
    isSearching = true;

    const input = document.getElementById('studentServicesId');
    const button = document.getElementById('studentServicesLoginBtn');

    if (input) input.value = rollno;
    if (button) {
      button.disabled = true;
      button.textContent = 'กำลังค้นหา...';
    }

    showSearching(rollno);

    try {
      const result = await lookupStudentByJsonp(rollno);

      if (result.success === false) {
        throw new Error(result.message || 'ค้นหาข้อมูลนักศึกษาไม่สำเร็จ');
      }

      if (!result.found) {
        if (window.Swal) {
          await Swal.fire({
            icon: 'error',
            title: 'ไม่พบข้อมูลนักศึกษา',
            text: `ไม่พบรหัสนักศึกษา ${rollno}`,
            confirmButtonText: 'ตกลง'
          });
        } else {
          window.alert(`ไม่พบรหัสนักศึกษา ${rollno}`);
        }

        input?.focus();
        return;
      }

      try {
        sessionStorage.setItem('SSS_PROFILE_ROLLNO', rollno);
      } catch (_) {}

      if (window.Swal) {
        const studentName = String(result.student?.Name || result.student?.name || '').trim();
        await Swal.fire({
          icon: 'success',
          title: 'พบข้อมูลนักศึกษา',
          text: studentName || `รหัสนักศึกษา ${rollno}`,
          showConfirmButton: false,
          timer: 650,
          timerProgressBar: true
        });
      }

      window.location.assign(`profile.html?rollno=${encodeURIComponent(rollno)}`);
    } catch (error) {
      console.error('student lookup error:', error);
      await showMessage({
        icon: 'error',
        title: 'ค้นหาข้อมูลไม่สำเร็จ',
        text: error?.message || 'ไม่สามารถเชื่อมต่อระบบค้นหานักศึกษาได้',
        confirmButtonText: 'ตกลง'
      });
      input?.focus();
    } finally {
      isSearching = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'LOGIN';
      }
    }
  }

  async function login(event) {
    event?.preventDefault();

    const input = document.getElementById('studentServicesId');
    const rollno = String(input?.value || '').replace(/\D/g, '').trim().slice(0, 10);

    if (!rollno) {
      await showMessage({
        icon: 'warning',
        title: 'กรุณากรอกรหัสนักศึกษา',
        text: 'ระบุรหัสนักศึกษาก่อนเข้าสู่ระบบ',
        confirmButtonText: 'ตกลง'
      });
      input?.focus();
      return;
    }

    await searchAndOpenProfile(rollno);
  }

  function init() {
    const form = document.getElementById('studentServicesLoginForm');
    const input = document.getElementById('studentServicesId');

    input?.addEventListener('input', () => {
      const rollno = String(input.value || '').replace(/\D/g, '').slice(0, 10);
      input.value = rollno;

      if (autoSearchTimer) window.clearTimeout(autoSearchTimer);

      if (rollno.length < 10) {
        lastAutoRollno = '';
        return;
      }

      if (rollno === lastAutoRollno || isSearching) return;
      lastAutoRollno = rollno;

      // เมื่อกรอกครบ 10 หลัก ให้ค้นหาอัตโนมัติ โดยยังคงปุ่ม LOGIN ไว้สำหรับการค้นหาแบบเดิม
      autoSearchTimer = window.setTimeout(() => searchAndOpenProfile(rollno), 250);
    });

    form?.addEventListener('submit', login);
    loadLoginCardConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
