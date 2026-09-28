import { getSession, signOut } from './auth.js';
import { getLang, setLang, applyI18n, t } from './i18n.js';

const NAV_LINKS = [
  { key: 'nav.search', href: 'search.html' },
  { key: 'nav.meeting', href: 'meeting-points.html' },
  { key: 'nav.column', href: 'column.html' },
  { key: 'nav.faq', href: 'index.html#faq-section' },
];

function headerHtml(loginKey, loginHref) {
  // Built after getSession() resolves (see mountLayout below), so the
  // current language is already known — interpolate the real text directly
  // rather than leaving elements empty for a later applyI18n() pass.
  const nav = NAV_LINKS.map((l) => `<a class="pm-nav-link" href="${l.href}" data-i18n="${l.key}">${t(l.key)}</a>`).join('');
  const loginLink = `<a class="pm-nav-link" href="${loginHref}" data-i18n="${loginKey}">${t(loginKey)}</a>`;
  return `
  <div class="pm-header-inner">
    <a class="pm-logo" href="index.html">
      <img class="pm-logo-icon" src="assets/photomatch-icon-transparent.png" alt="">
      <img class="pm-logo-type" src="assets/photomatch-wordmark.png" alt="Photo match" width="176" height="22">
    </a>
    <div class="pm-nav-desktop pm-desktop-only">
      <nav>${nav}</nav>
      <div class="pm-nav-actions">
        <button type="button" class="pm-lang-toggle" id="pm-lang-toggle-desktop" data-i18n="lang.toggle.label">${t('lang.toggle.label')}</button>
        ${loginLink}
        <a class="pm-btn pm-btn-primary" href="search.html" data-i18n="nav.cta">${t('nav.cta')}</a>
      </div>
    </div>
    <div class="pm-mobile-actions pm-mobile-only">
      <button type="button" class="pm-lang-toggle" id="pm-lang-toggle-mobile" data-i18n="lang.toggle.label">${t('lang.toggle.label')}</button>
      <button class="pm-menu-btn" id="pm-menu-toggle" aria-controls="pm-mobile-panel" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  <div class="pm-mobile-panel pm-mobile-only" id="pm-mobile-panel" hidden>
    ${nav}
    ${loginLink}
    <a class="pm-btn pm-btn-primary" style="margin-top:10px;justify-content:center" href="search.html" data-i18n="nav.cta">${t('nav.cta')}</a>
  </div>`;
}

function footerHtml() {
  return `
  <div class="pm-footer-inner">
    <div>
      <img src="assets/photomatch-logo-full-transparent.png" alt="PhotoMatch" style="height:120px;width:auto;object-fit:contain;margin-bottom:10px">
      <div style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3)"><span data-i18n="footer.tagline">名古屋発、マッチングアプリ写真専門サービス</span><br>© 2026 PhotoMatch</div>
    </div>
    <div class="pm-footer-links">
      <div class="pm-h" data-i18n="footer.serviceInfo">サービス情報</div>
      <a href="terms.html?key=company" data-i18n="footer.company">運営会社</a>
      <a href="column.html" data-i18n="footer.column">コラム</a>
      <a href="monitor.html" data-i18n="footer.monitor">モニター価格プラン募集</a>
      <a href="terms.html?key=tokushoho" data-i18n="footer.tokushoho">特定商取引法に基づく表記</a>
      <a href="terms.html?key=privacy" data-i18n="footer.privacy">プライバシーポリシー</a>
      <a href="terms.html?key=terms" data-i18n="footer.terms">利用規約</a>
    </div>
  </div>`;
}

export async function mountLayout() {
  const headerEl = document.getElementById('pm-header');
  const footerEl = document.getElementById('pm-footer');

  let loginKey = 'nav.login';
  let loginHref = 'login.html';
  try {
    const session = await getSession();
    if (session) { loginKey = 'nav.mypage'; loginHref = 'mypage.html'; }
  } catch (e) { /* supabase not configured yet */ }

  if (headerEl) {
    headerEl.innerHTML = headerHtml(loginKey, loginHref);
    const toggle = document.getElementById('pm-menu-toggle');
    const panel = document.getElementById('pm-mobile-panel');
    if (toggle && panel) {
      toggle.setAttribute('aria-label', t('nav.menu'));
      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
      });
    }
    // Switching reloads the page so every page's own script re-renders its
    // (js/data.js- and DB-sourced) content in the new language too — a live
    // in-place re-render would need every page to duplicate that logic.
    ['pm-lang-toggle-desktop', 'pm-lang-toggle-mobile'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => {
        setLang(getLang() === 'en' ? 'ja' : 'en');
        location.reload();
      });
    });
  }
  if (footerEl) footerEl.innerHTML = footerHtml();
  applyI18n();
}

export { signOut };
