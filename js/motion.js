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

// ---- UI のマイクロインタラクション（layout.js の mountLayout() から全ページで1回呼ぶ） ----
// 押したボタンの波紋・ヘッダーの影・スクロール進捗バー・先頭へ戻るボタン・写真のふわっと表示・
// ヒーロー写真の傾き・「いいねUP！」のハート。見た目は css/components.css の「マイクロインタラクション」。
let interactionsStarted = false;

export function initInteractions() {
  if (interactionsStarted) return;
  interactionsStarted = true;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPublic = PUBLIC_PAGES.test(currentPage());

  // ボタンを押した場所から波紋
  if (!calm) {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.pm-btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'pm-ripple';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    });
  }

  // スクロールに合わせて：ヘッダーの影・進捗バー・先頭へ戻るボタン
  const header = document.getElementById('pm-header');
  const bar = isPublic ? document.body.appendChild(Object.assign(document.createElement('div'), { className: 'pm-progress' })) : null;
  let toTop = null;
  if (isPublic) {
    toTop = document.createElement('button');
    toTop.type = 'button';
    toTop.className = 'pm-to-top';
    toTop.textContent = '↑';
    toTop.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Back to top' : 'ページの先頭へ');
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }));
    document.body.appendChild(toTop);
  }
  if (bar) bar.setAttribute('aria-hidden', 'true');
  let queued = false;
  const onScroll = () => {
    queued = false;
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 8);
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    }
    toTop?.classList.toggle('is-on', y > window.innerHeight * 1.2);
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  if (calm) return;

  // 遅れて読み込む写真は、読み込めたらふわっと表示（公開ページ）
  if (isPublic) {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      if (img.complete) return;
      img.classList.add('pm-img-fade');
      const done = () => img.classList.add('is-loaded');
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  // ヒーロー写真：マウスの位置に合わせて傾ける（マウス操作の端末だけ）
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.pm-hero2-photos figure').forEach((fig) => {
      fig.addEventListener('pointermove', (e) => {
        const r = fig.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        fig.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        fig.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      });
      fig.addEventListener('pointerleave', () => { fig.style.removeProperty('--rx'); fig.style.removeProperty('--ry'); });
    });
  }

  // 「いいねUP！」をタップするとハートが飛ぶ
  document.addEventListener('click', (e) => {
    const badge = e.target.closest('.pm-like-badge');
    if (!badge) return;
    for (let i = 0; i < 7; i += 1) {
      const h = document.createElement('span');
      h.className = 'pm-heart';
      h.setAttribute('aria-hidden', 'true');
      h.textContent = i % 3 === 0 ? '💗' : '❤️';
      const angle = (-150 + i * 20) * (Math.PI / 180);
      const dist = 80 + Math.random() * 50;
      h.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      h.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      h.style.animationDelay = `${i * 30}ms`;
      badge.appendChild(h);
      h.addEventListener('animationend', () => h.remove());
    }
  });
}

// 名古屋／岐阜のようなタブの、選んだタブの下へつまみをすべらせる。タブを切り替えるたびに呼ぶ。
// 文字の読み込みや画面幅の変化でタブの幅が変わったときも、つまみを合わせ直す。
export function slideTabIndicator(tabsEl) {
  let ind = tabsEl.querySelector('.pm-loc-tab-ind');
  const place = () => {
    const on = tabsEl.querySelector('[aria-selected="true"]');
    if (!on) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.translate = `${on.offsetLeft}px 0`;
  };
  if (!ind) {
    ind = document.createElement('span');
    ind.className = 'pm-loc-tab-ind';
    ind.setAttribute('aria-hidden', 'true');
    tabsEl.prepend(ind);
    tabsEl.classList.add('has-ind');
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(tabsEl);
  }
  place();
}
