// スクロールに合わせたアニメーション（ふわっと表示・数字のカウントアップ・グラフの伸び）。
//
// 使い方（HTML 側）：
//   data-reveal="up|left|right|zoom|pop"  画面に入ったら表示（値なしは up）
//   data-stagger="up|..."                  子要素を順番に表示（子に data-reveal と --i を付ける）
//   data-count                             中の数字を 0 からカウントアップ（例：「350+」「¥6,800」）
//   style="--i:2"                          表示の遅れ（1 につき 90ms）
// 見た目は css/components.css の「モーション」。
//
// 動きを減らす設定（prefers-reduced-motion）や IntersectionObserver が無いブラウザでは
// 何もしない＝最初から全部表示される。<html> に .pm-motion が付いたときだけ、隠してから出す。
//
// 公開ページ（PUBLIC_PAGES）では、data-reveal が無くても見出し・カードを自動で表示アニメ対象にする。
// 予約・管理画面などの操作する画面は対象外。

const PUBLIC_PAGES = /^(index|nagoya|gifu|column(-[\w-]+)?|article|meeting-points|monitor)$/;
const AUTO_SELECTOR = '.pm-eyebrow, .pm-section-title, .pm-section-sub, .pm-card';
const SKIP_INSIDE = 'header, footer, .pm-hero2, .pm-sticky-cta, [data-no-reveal]';
const MAX_STAGGER = 6;

const seen = new WeakSet();
let io = null;

function motionAllowed() {
  return 'IntersectionObserver' in window
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function currentPage() {
  const last = location.pathname.split('/').pop() || 'index';
  return last.replace(/\.html$/, '');
}

// 「350+」「¥6,800」「45分」などの数字部分だけを、0 から増やして最後に元の文字へ戻す。
function countUp(el) {
  const text = el.textContent;
  const m = text.match(/^(\D*)([\d,]+)(.*)$/s);
  if (!m) return;
  const [, pre, numText, post] = m;
  const target = Number(numText.replace(/,/g, ''));
  if (!Number.isFinite(target) || target === 0) return;
  const comma = numText.includes(',');
  const dur = Number(el.dataset.countDuration) || 1400;
  const delay = Number(el.dataset.countDelay) || 0;
  const fmt = (n) => (comma ? n.toLocaleString('en-US') : String(n));
  el.textContent = pre + fmt(0) + post;
  setTimeout(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - (1 - p) ** 3;
      if (p < 1) {
        el.textContent = pre + fmt(Math.round(target * eased)) + post;
        requestAnimationFrame(tick);
      } else {
        el.textContent = text;
      }
    };
    requestAnimationFrame(tick);
  }, delay);
}

function onEnter(entries) {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    io.unobserve(el);
    el.classList.add('is-in');
    if (el.hasAttribute('data-count')) countUp(el);
  });
}

function watch(el) {
  if (seen.has(el)) return;
  seen.add(el);
  io.observe(el);
}

// root の中の対象要素を監視する。何度呼んでもよい（新しく描画した部分だけ追加される）。
export function observeReveal(root = document) {
  if (!motionAllowed()) return;
  if (!io) {
    document.documentElement.classList.add('pm-motion');
    io = new IntersectionObserver(onEnter, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  }

  root.querySelectorAll('[data-stagger]').forEach((parent) => {
    const kind = parent.dataset.stagger || 'up';
    [...parent.children].forEach((child, i) => {
      if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', kind);
      child.style.setProperty('--i', String(Math.min(i, MAX_STAGGER)));
    });
  });

  if (PUBLIC_PAGES.test(currentPage())) {
    root.querySelectorAll(AUTO_SELECTOR).forEach((el) => {
      if (el.hasAttribute('data-reveal') || el.closest(SKIP_INSIDE) || el.closest('[data-reveal], [data-stagger]')) return;
      el.setAttribute('data-reveal', 'up');
      const siblings = [...el.parentElement.children].filter((c) => c.matches(AUTO_SELECTOR));
      const i = siblings.indexOf(el);
      if (i > 0) el.style.setProperty('--i', String(Math.min(i, MAX_STAGGER)));
    });
  }

  root.querySelectorAll('[data-reveal], [data-count]').forEach(watch);
}
