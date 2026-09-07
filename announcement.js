(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return /^https?:$/i.test(url.protocol) ? url.toString() : '';
    } catch (_) {
      return '';
    }
  }

  function setSocial(id, value) {
    const element = document.getElementById(id);
    if (!element) return false;

    const url = safeUrl(value);
    element.hidden = !url;

    if (url) element.href = url;
    else element.removeAttribute('href');

    return Boolean(url);
  }

  function enableAnnouncementLink(element) {
    if (!element || element.dataset.chiangklangLinkReady === '1') return;
    element.dataset.chiangklangLinkReady = '1';
    element.setAttribute('role', 'link');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', 'เปิดเว็บไซต์ สกร.ระดับอำเภอเชียงกลาง');
    const openInSameTab = function () {
      window.location.href = 'https://chiangklangdole.ac.th';
    };
    element.addEventListener('click', openInSameTab);
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInSameTab();
      }
    });
  }

  async function loadAnnouncement() {
    const announcement = document.getElementById('announcementText');
    const socials = document.getElementById('announcementSocials');
    enableAnnouncementLink(announcement);

    try {
      let result;

      if (window.SiteFast) {
        result = Object.assign({ success: true }, await window.SiteFast.homePart('about'));
      } else {
        const url = new URL(API_URL);
        url.searchParams.set('mode', 'aboutPages');
        const response = await fetch(url.toString(), { cache: 'default' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูล announcement ไม่สำเร็จ');
      }

      const contact = result.contact || {};
      const organization = String(contact.organization || '').trim();

      if (announcement) {
        announcement.textContent = organization;
        announcement.hidden = !organization;
      }

      const hasLine = setSocial('announcementLine', contact.line);
      const hasFacebook = setSocial('announcementFacebook', contact.facebook);
      const hasYoutube = setSocial('announcementYoutube', contact.youtube);
      if (socials) socials.hidden = !(hasLine || hasFacebook || hasYoutube);
    } catch (error) {
      console.error('loadAnnouncement error:', error);
      if (announcement) announcement.hidden = true;
      if (socials) socials.hidden = true;
    }
  }

  document.addEventListener('DOMContentLoaded', loadAnnouncement);
})();
