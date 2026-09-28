import { mountLayout } from '../layout.js';
import { STATS, TARGET_PAINS, SUPPORTED_APPS, SHOT_TYPES, TESTIMONIALS, PRICING_PLANS, SAFETY_POINTS, FAQS, HOW_IT_WORKS } from '../data.js';

mountLayout();

document.getElementById('pm-stats').innerHTML = STATS.map((s) => `
  <div class="pm-card" style="text-align:center;padding:28px 16px">
    <div style="font:800 32px var(--pm-font-num);background:linear-gradient(120deg, oklch(0.6 0.15 200), oklch(0.55 0.15 245));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px">${s.value}</div>
    <div style="font:13px var(--pm-font-body);color:var(--pm-text-3)">${s.label}</div>
  </div>`).join('');

// Hero keeps a one-line version of the stats so the trust signal is still
// seen by people who leave before the full 実績 section further down.
document.getElementById('pm-hero-proof').innerHTML = STATS.map((s) => `
  <span style="white-space:nowrap">${s.label} <b style="font:800 15px var(--pm-font-num);color:oklch(0.45 0.14 210)">${s.value}</b></span>`).join('<span style="color:var(--pm-text-muted);margin:0 10px">／</span>')
  + '<a href="#results-section" style="display:block;margin-top:4px;font:11px var(--pm-font-body);color:var(--pm-text-muted);text-decoration:underline">※代表カメラマンの実績です</a>';

document.getElementById('pm-pains').innerHTML = TARGET_PAINS.map((p) => `
  <div style="display:flex;align-items:flex-start;gap:10px;background:oklch(1 0 0 / 0.08);border:1px solid oklch(1 0 0 / 0.14);border-radius:12px;padding:14px 16px">
    <span style="font:700 14px var(--pm-font-num);color:oklch(0.82 0.12 195);flex-shrink:0">✓</span>
    <span style="font:13px/1.7 var(--pm-font-body);color:oklch(0.95 0.005 220)">${p}</span>
  </div>`).join('');

document.getElementById('pm-apps').innerHTML = SUPPORTED_APPS.map((a) => `
  <span style="padding:9px 18px;border-radius:100px;background:oklch(0.97 0.012 215);border:1px solid var(--pm-border);font:700 14px var(--pm-font-num);color:oklch(0.38 0.03 235)">${a}</span>`).join('');

document.getElementById('pm-shots').innerHTML = SHOT_TYPES.map((s) => `
  <div class="pm-card" style="border-radius:14px;overflow:hidden">
    <div style="aspect-ratio:3/4;background-image:url(${s.image});background-size:cover;background-position:center"></div>
  </div>`).join('');

document.getElementById('pm-testimonials').innerHTML = TESTIMONIALS.map((t) => `
  <div class="pm-card" style="padding:24px">
    <div style="font:13px var(--pm-font-body);color:var(--pm-star);margin-bottom:10px">${t.starsLabel}</div>
    <div style="font:14px/1.8 var(--pm-font-body);color:oklch(0.35 0.02 235);margin-bottom:16px">${t.comment}</div>
    <div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3)">${t.name}</div>
  </div>`).join('');

document.getElementById('pm-steps').innerHTML = HOW_IT_WORKS.map((s) => `
  <div class="pm-card" style="padding:26px 24px;position:relative">
    <div style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 15px var(--pm-font-num);margin-bottom:14px">${s.step}</div>
    <div style="font:700 16px var(--pm-font-body);margin-bottom:8px">${s.title}</div>
    <div style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:14px">${s.desc}</div>
    <div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.42 0.1 215);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px">${s.note}</div>
  </div>`).join('');

document.getElementById('pm-pricing').innerHTML = PRICING_PLANS.map((pl) => `
  <a href="search.html" class="pm-card" style="display:block;border-radius:18px;padding:28px;text-decoration:none;color:inherit">
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">${pl.name}</div>
    ${pl.originalPrice ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font:600 14px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${pl.originalPrice}</span>
      <span style="font:700 11px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 8px;border-radius:100px">${pl.discountLabel}</span>
    </div>` : ''}
    <div style="font:800 26px var(--pm-font-num);margin-bottom:4px">¥${pl.price}</div>
    <div style="font:11px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">税込</div>
    <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:16px">${pl.desc}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;background:var(--pm-brand-grad);color:#fff;border-radius:10px;padding:12px;font:700 13px var(--pm-font-body)">このプランで予約する</div>
  </a>`).join('');

document.getElementById('pm-safety').innerHTML = SAFETY_POINTS.map((s) => `
  <div class="pm-card" style="padding:24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="width:28px;height:28px;flex-shrink:0;border-radius:8px;background:oklch(0.94 0.05 200);color:oklch(0.4 0.14 200);display:flex;align-items:center;justify-content:center;font:700 14px var(--pm-font-num)">✓</span>
      <span style="font:700 15px var(--pm-font-body)">${s.title}</span>
    </div>
    <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3)">${s.desc}</div>
  </div>`).join('');

// <details>/<summary> gives keyboard (Enter/Space, Tab) and screen-reader
// support for free — the previous clickable <div> had neither.
const faqEl = document.getElementById('pm-faqs');
faqEl.innerHTML = FAQS.map((f) => `
  <details class="pm-card pm-faq-item" style="border-radius:14px;overflow:hidden">
    <summary class="pm-faq-q">
      <span style="font:700 15px var(--pm-font-body);color:oklch(0.28 0.02 240)">${f.q}</span>
      <span class="pm-faq-icon" style="font:600 18px var(--pm-font-num);color:oklch(0.6 0.12 210);flex-shrink:0"></span>
    </summary>
    <div style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);padding:0 20px 18px">${f.a}</div>
  </details>`).join('');

// Mobile sticky "撮影を予約する" bar: visible while scrolling through the page,
// hidden while the hero's own button or the final CTA section is on screen so
// it never sits redundantly next to another copy of the same button.
{
  const bar = document.getElementById('pm-mobile-cta');
  const heroCta = document.getElementById('hero-cta');
  const finalCta = document.getElementById('final-cta-section');
  if (bar && heroCta && finalCta && 'IntersectionObserver' in window) {
    const heroVisible = new Set();
    const finalVisible = new Set();
    const update = () => { bar.style.display = heroVisible.size || finalVisible.size ? 'none' : ''; };
    new IntersectionObserver(([e]) => { e.isIntersecting ? heroVisible.add(1) : heroVisible.delete(1); update(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { e.isIntersecting ? finalVisible.add(1) : finalVisible.delete(1); update(); }).observe(finalCta);
  }
}
