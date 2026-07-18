import { mountLayout } from '../layout.js';
import { STATS, TARGET_PAINS, SUPPORTED_APPS, SHOT_TYPES, TESTIMONIALS, PRICING_PLANS, SAFETY_POINTS, FAQS } from '../data.js';

mountLayout();

document.getElementById('pm-stats').innerHTML = STATS.map((s) => `
  <div class="pm-card" style="text-align:center;padding:28px 16px">
    <div style="font:800 32px var(--pm-font-num);background:linear-gradient(120deg, oklch(0.6 0.15 200), oklch(0.55 0.15 245));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px">${s.value}</div>
    <div style="font:13px var(--pm-font-body);color:var(--pm-text-3)">${s.label}</div>
  </div>`).join('');

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

document.getElementById('pm-pricing').innerHTML = PRICING_PLANS.map((pl) => `
  <a href="search.html" class="pm-card" style="display:block;border-radius:18px;padding:28px;text-decoration:none;color:inherit">
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">${pl.name}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font:600 14px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${pl.originalPrice}</span>
      <span style="font:700 11px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 8px;border-radius:100px">${pl.discountLabel}</span>
    </div>
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

const faqEl = document.getElementById('pm-faqs');
faqEl.innerHTML = FAQS.map((f, idx) => `
  <div class="pm-card" style="border-radius:14px;overflow:hidden">
    <div data-faq-idx="${idx}" class="pm-faq-q" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 20px">
      <span style="font:700 15px var(--pm-font-body);color:oklch(0.28 0.02 240)">${f.q}</span>
      <span class="pm-faq-icon" style="font:600 18px var(--pm-font-num);color:oklch(0.6 0.12 210);flex-shrink:0">＋</span>
    </div>
    <div class="pm-faq-a" style="display:none;font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);padding:0 20px 18px">${f.a}</div>
  </div>`).join('');

faqEl.addEventListener('click', (e) => {
  const q = e.target.closest('.pm-faq-q');
  if (!q) return;
  const card = q.parentElement;
  const answer = card.querySelector('.pm-faq-a');
  const icon = card.querySelector('.pm-faq-icon');
  const open = answer.style.display === 'block';
  answer.style.display = open ? 'none' : 'block';
  icon.textContent = open ? '＋' : '−';
});
