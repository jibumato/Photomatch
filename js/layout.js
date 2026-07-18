import { getSession, signOut } from './auth.js';

const NAV_LINKS = [
  { label: 'カメラマンを探す', href: 'search.html' },
  { label: '集合場所', href: 'meeting-points.html' },
  { label: 'コラム', href: 'column.html' },
  { label: 'よくある質問', href: 'index.html#faq-section' },
];

function headerHtml(loginLabel, loginHref) {
  const nav = NAV_LINKS.map((l) => `<a class="pm-nav-link" href="${l.href}">${l.label}</a>`).join('');
  return `
  <div class="pm-header-inner">
    <a class="pm-logo" href="index.html">
      <img src="assets/photomatch-icon-transparent.png" alt="">
      <span>Photo match</span>
    </a>
    <div class="pm-nav-desktop pm-desktop-only">
      <nav>${nav}</nav>
      <div class="pm-nav-actions">
        <a class="pm-nav-link" href="${loginHref}">${loginLabel}</a>
        <a class="pm-btn pm-btn-primary" href="search.html">撮影を予約する</a>
      </div>
    </div>
    <button class="pm-menu-btn pm-mobile-only" id="pm-menu-toggle" aria-label="メニュー">
      <span></span><span></span><span></span>
    </button>
  </div>
  <div class="pm-mobile-panel pm-mobile-only" id="pm-mobile-panel" hidden>
    ${NAV_LINKS.map((l) => `<a class="pm-nav-link" href="${l.href}">${l.label}</a>`).join('')}
    <a class="pm-nav-link" href="${loginHref}">${loginLabel}</a>
    <a class="pm-btn pm-btn-primary" style="margin-top:10px;justify-content:center" href="search.html">撮影を予約する</a>
  </div>`;
}

function footerHtml() {
  return `
  <div class="pm-footer-inner">
    <div>
      <img src="assets/photomatch-logo-full-transparent.png" alt="PhotoMatch" style="height:120px;width:auto;object-fit:contain;margin-bottom:10px">
      <div style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3)">名古屋発、マッチングアプリ写真専門サービス。<br>© 2026 PhotoMatch</div>
    </div>
    <div class="pm-footer-links">
      <div class="pm-h">サービス情報</div>
      <a href="terms.html?key=company">運営会社</a>
      <a href="column.html">コラム</a>
      <a href="terms.html?key=tokushoho">特定商取引法に基づく表記</a>
      <a href="terms.html?key=privacy">プライバシーポリシー</a>
      <a href="terms.html?key=terms">利用規約</a>
      <a href="pro-login.html">カメラマン管理（シフト）</a>
    </div>
  </div>`;
}

export async function mountLayout() {
  const headerEl = document.getElementById('pm-header');
  const footerEl = document.getElementById('pm-footer');

  let loginLabel = 'ログイン';
  let loginHref = 'login.html';
  try {
    const session = await getSession();
    if (session) { loginLabel = 'マイページ'; loginHref = 'mypage.html'; }
  } catch (e) { /* supabase not configured yet */ }

  if (headerEl) {
    headerEl.innerHTML = headerHtml(loginLabel, loginHref);
    const toggle = document.getElementById('pm-menu-toggle');
    const panel = document.getElementById('pm-mobile-panel');
    if (toggle && panel) {
      toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; });
    }
  }
  if (footerEl) footerEl.innerHTML = footerHtml();
}

export { signOut };
