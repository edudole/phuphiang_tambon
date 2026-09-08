(() => {
  'use strict';

  let isSearching = false;
  let autoSearchTimer = 0;
  let lastAutoRollno = '';
  let activeResultMessageHandler = null;

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

  function getStudentWebAppUrl() {
    return String(window.STUDENT_PROFILE_WEB_APP_URL || '').trim();
  }

  function removeStudentResultFrame() {
    if (activeResultMessageHandler) {
      window.removeEventListener('message', activeResultMessageHandler);
      activeResultMessageHandler = null;
    }

    const overlay = document.getElementById('studentServicesResultFrame');
    if (overlay) overlay.remove();

    document.documentElement.classList.remove('student-result-open');
    document.body.classList.remove('student-result-open');
  }

  function returnToStudentSearch() {
    removeStudentResultFrame();

    const input = document.getElementById('studentServicesId');
    if (input) {
      input.value = '';
      input.focus();
    }

    lastAutoRollno = '';

    const section = document.getElementById('studentServicesBox');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function prepareStudentResultFrame(rollno) {
    const webAppUrl = getStudentWebAppUrl();
    if (!webAppUrl) {
      return Promise.reject(new Error('ยังไม่ได้กำหนด URL ของ Student Service Web App'));
    }

    removeStudentResultFrame();

    // สร้าง iframe แบบซ่อนก่อน เพื่อให้ผู้ใช้ยังเห็น popup "กำลังค้นหา"
    // จนกว่า Web App จะยืนยันว่า showResult() สร้างหน้าผลลัพธ์เสร็จแล้ว
    const overlay = document.createElement('div');
    overlay.id = 'studentServicesResultFrame';
    overlay.setAttribute('aria-label', 'ผลข้อมูลนักศึกษา');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'width:100vw',
      'height:100vh',
      'background:#fff',
      'overflow:hidden',
      'visibility:hidden',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity .12s ease'
    ].join(';');

    const frame = document.createElement('iframe');
    frame.id = 'studentServicesWebAppFrame';
    frame.title = 'ข้อมูลนักศึกษา';
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#fff;';
    frame.setAttribute('allow', 'fullscreen');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    const url = new URL(webAppUrl);
    url.searchParams.set('rollno', rollno);
    url.searchParams.set('autologin', '1');
    url.searchParams.set('_github', Date.now().toString());
    frame.src = url.toString();

    overlay.appendChild(frame);
    document.body.appendChild(overlay);

    return new Promise((resolve, reject) => {
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        removeStudentResultFrame();
        reject(new Error('ระบบ Student Service ใช้เวลาตอบกลับนานเกินไป กรุณาลองใหม่'));
      }, 60000);

      const cleanupSearchOnly = () => {
        window.clearTimeout(timeout);
      };

      const settleError = message => {
        if (settled) return;
        settled = true;
        cleanupSearchOnly();
        removeStudentResultFrame();
        reject(new Error(message || `ไม่พบข้อมูลนักศึกษา ${rollno}`));
      };

      const onMessage = event => {
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'SSS_STUDENT_LOGOUT') {
          returnToStudentSearch();
          return;
        }

        if (data.type !== 'SSS_STUDENT_RESULT') return;

        const resultRollno = String(data.rollno || '')
          .replace(/\D/g, '')
          .slice(0, 10);

        if (resultRollno && resultRollno !== rollno) return;

        if (!data.found) {
          settleError(data.error || `ไม่พบข้อมูลนักศึกษา ${rollno}`);
          return;
        }

        if (settled) return;
        settled = true;
        cleanupSearchOnly();

        // Web App ส่งข้อความนี้หลัง showResult() สร้างหน้าผลลัพธ์แล้ว
        // ค่อยเปิด iframe ตอนนี้ จึงไม่เห็นจอขาวระหว่างค้นหา
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        document.documentElement.classList.add('student-result-open');
        document.body.classList.add('student-result-open');

        resolve(data);
      };

      activeResultMessageHandler = onMessage;
      window.addEventListener('message', onMessage);

      frame.addEventListener('error', () => {
        settleError('ไม่สามารถโหลดหน้า Student Service ได้');
      }, { once: true });
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
      await prepareStudentResultFrame(rollno);
      if (window.Swal) Swal.close();
      try { sessionStorage.setItem('SSS_PROFILE_ROLLNO', rollno); } catch (_) {}
    } catch (error) {
      console.error('student result frame error:', error);
      removeStudentResultFrame();
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
    const rollno = String(input?.value || '')
      .replace(/\D/g, '')
      .trim()
      .slice(0, 10);

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

    if (rollno.length !== 10) {
      await showMessage({
        icon: 'warning',
        title: 'รหัสนักศึกษาไม่ครบ',
        text: 'กรุณากรอกรหัสนักศึกษา 10 หลัก',
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
      const rollno = String(input.value || '')
        .replace(/\D/g, '')
        .slice(0, 10);
      input.value = rollno;

      if (autoSearchTimer) window.clearTimeout(autoSearchTimer);

      if (rollno.length < 10) {
        lastAutoRollno = '';
        return;
      }

      if (rollno === lastAutoRollno || isSearching) return;
      lastAutoRollno = rollno;

      autoSearchTimer = window.setTimeout(() => {
        searchAndOpenProfile(rollno);
      }, 250);
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
