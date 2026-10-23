// アクセス解析（Google アナリティクス 4）。
//
// GA_MEASUREMENT_ID に GA4 の「測定 ID」（G-XXXXXXXXXX）を入れると有効になる。空の間は何も読み込まない。
// layout.js の mountLayout() から全ページで呼ばれる。
//
// 送らないもの：
//   ・運営画面・カメラマンの管理画面・報酬明細など、会員の内部ページ（EXCLUDED_PAGES）
//   ・パスワード再設定・メール確認のページ（URL にトークンが付くため）
//   ・ローカル確認（localhost など）
// お名前・メール・電話番号などの個人情報は、イベントにも入れない。
// プライバシーポリシー（js/data.js の LEGAL_PAGES.privacy の「6. アクセス解析ツールについて」）に、利用を明記している。

export const GA_MEASUREMENT_ID = '';

const EXCLUDED_PAGES = [
  'ops', 'ops-login', 'ops-sales', 'admin', 'pro-login', 'payslip',
  'reset-password', 'email-confirmed',
];

function currentPage() {
  const last = location.pathname.split('/').pop() || 'index';
  return last.replace(/\.html$/, '');
}

function enabled() {
  if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) return false;
  if (['localhost', '127.0.0.1', ''].includes(location.hostname)) return false;
  return !EXCLUDED_PAGES.includes(currentPage());
}

let started = false;

export function initAnalytics() {
  if (started || !enabled()) return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

// イベントを送る（無効のときは何もしない）。params に個人情報を入れないこと。
export function trackEvent(name, params = {}) {
  if (!enabled()) return;
  initAnalytics();
  window.gtag('event', name, params);
}

// 1回だけ送るイベント（予約完了ページの再読み込みで二重に数えないため）。
export function trackEventOnce(key, name, params = {}) {
  try {
    if (sessionStorage.getItem(`pm_ga_${key}`)) return;
    sessionStorage.setItem(`pm_ga_${key}`, '1');
  } catch (e) { /* storage unavailable: send anyway (GA4 also dedupes purchases by transaction_id) */ }
  trackEvent(name, params);
}
