import { mountLayout } from '../layout.js';
import {
  STATS, TARGET_PAINS, TARGET_PAINS_EN, SUPPORTED_APPS, SUPPORTED_APPS_EN,
  TESTIMONIALS, PRICING_PLANS, SAFETY_POINTS, FAQS, HOW_IT_WORKS,
  SEASONS, SEASONAL_LOCATIONS, seasonForMonth, jstDateIso,
} from '../data.js';
import { getLang, L, t, tf, discountLabelText } from '../i18n.js';
import { escapeHtml } from '../util.js';

mountLayout();

document.getElementById('pm-stats').innerHTML = STATS.map((s) => `
  <div class="pm-card" style="text-align:center;padding:28px 16px">
    <div style="font:800 32px var(--pm-font-num);background:linear-gradient(120deg, oklch(0.6 0.15 200), oklch(0.55 0.15 245));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px">${s.value}</div>
    <div style="font:13px var(--pm-font-body);color:var(--pm-text-3)">${L(s, 'label')}</div>
  </div>`).join('');

// Hero keeps a one-line version of the stats so the trust signal is still
// seen by people who leave before the full 実績 section further down.
document.getElementById('pm-hero-proof').innerHTML = STATS.map((s) => `
  <span style="white-space:nowrap">${L(s, 'label')} <b style="font:800 15px var(--pm-font-num);color:oklch(0.45 0.14 210)">${s.value}</b></span>`).join('<span style="color:var(--pm-text-muted);margin:0 10px">／</span>')
  + `<a href="#results-section" style="display:block;margin-top:4px;font:11px var(--pm-font-body);color:var(--pm-text-muted);text-decoration:underline">${getLang() === 'en' ? '※ track record of our photographers (see below)' : '※カメラマンの実績の合計です（詳細は下記）'}</a>`;

const painsList = getLang() === 'en' ? TARGET_PAINS_EN : TARGET_PAINS;
document.getElementById('pm-pains').innerHTML = painsList.map((p) => `
  <div style="display:flex;align-items:flex-start;gap:10px;background:oklch(1 0 0 / 0.08);border:1px solid oklch(1 0 0 / 0.14);border-radius:12px;padding:14px 16px">
    <span style="font:700 14px var(--pm-font-num);color:oklch(0.82 0.12 195);flex-shrink:0">✓</span>
    <span style="font:13px/1.7 var(--pm-font-body);color:oklch(0.95 0.005 220)">${p}</span>
  </div>`).join('');

document.getElementById('pm-apps').innerHTML = SUPPORTED_APPS.map((a) => `
  <span style="padding:9px 18px;border-radius:100px;background:oklch(0.97 0.012 215);border:1px solid var(--pm-border);font:700 14px var(--pm-font-num);color:oklch(0.38 0.03 235)">${getLang() === 'en' ? (SUPPORTED_APPS_EN[a] || a) : a}</span>`).join('');

// No testimonials yet -> drop the whole お客様の声 block instead of showing an empty heading.
// Before is shown small and After large, so the change reads at a glance.
const voiceBeforeAfter = (before, after, badge) => `
  <div style="display:grid;grid-template-columns:minmax(0,0.5fr) minmax(0,1fr);align-items:end;gap:clamp(14px,4vw,28px);margin-bottom:22px">
    <figure style="margin:0 0 clamp(8px,3vw,20px)">
      <div style="font:800 10px/1 var(--pm-font-num);letter-spacing:0.14em;color:var(--pm-text-muted);margin-bottom:8px">BEFORE</div>
      <img src="${before.src}" alt="${L(before, 'alt')}" width="720" height="960" loading="lazy" style="display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:10px;transform:rotate(-3deg);box-shadow:0 4px 12px oklch(0.3 0.02 235 / 0.15);border:4px solid #fff">
    </figure>
    <figure style="margin:0;position:relative">
      <img src="${after.src}" alt="${L(after, 'alt')}" width="720" height="960" loading="lazy" style="display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:16px;box-shadow:0 0 0 3px #fff,0 0 0 6px oklch(0.7 0.13 205),0 18px 40px oklch(0.55 0.15 220 / 0.35)">
      <figcaption style="position:absolute;left:12px;top:12px;padding:6px 14px;border-radius:100px;background:var(--pm-brand-grad);color:#fff;font:800 13px/1.3 var(--pm-font-num);letter-spacing:0.12em;box-shadow:0 4px 12px oklch(0.5 0.15 220 / 0.35)">AFTER</figcaption>
      ${badge ? `<span class="pm-like-badge">${badge}</span>` : ''}
      <span aria-hidden="true" style="position:absolute;left:0;top:50%;transform:translate(-62%,-50%);display:flex;align-items:center;justify-content:center;width:clamp(34px,9vw,46px);height:clamp(34px,9vw,46px);border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 clamp(16px,4vw,20px)/1 var(--pm-font-num);box-shadow:0 0 0 4px #fff,0 6px 16px oklch(0.5 0.15 220 / 0.35)">→</span>
    </figure>
  </div>`;
if (TESTIMONIALS.length) {
  document.getElementById('pm-testimonials').innerHTML = TESTIMONIALS.map((item) => `
  <div class="pm-card" style="padding:clamp(18px,4vw,28px)">
    ${item.before && item.after ? voiceBeforeAfter(item.before, item.after, L(item, 'badge')) : ''}
    ${item.starsLabel ? `<div style="font:13px var(--pm-font-body);color:var(--pm-star);margin-bottom:10px">${item.starsLabel}</div>` : ''}
    <blockquote style="margin:0;font:14px/1.9 var(--pm-font-body);color:oklch(0.35 0.02 235)">“${L(item, 'comment')}”</blockquote>
    ${item.name ? `<div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3);margin-top:16px">${L(item, 'name')}</div>` : ''}
  </div>`).join('');
} else {
  document.getElementById('pm-voice').remove();
}

document.getElementById('pm-steps').innerHTML = HOW_IT_WORKS.map((s) => `
  <div class="pm-card" style="padding:26px 24px;position:relative">
    ${s.img ? `<img src="${s.img}" alt="" style="width:100%;aspect-ratio:900/484;object-fit:cover;border-radius:12px;margin-bottom:16px">` : ''}
    <div style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 15px var(--pm-font-num);margin-bottom:14px">${s.step}</div>
    <div style="font:700 16px var(--pm-font-body);margin-bottom:8px">${L(s, 'title')}</div>
    <div style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:14px">${L(s, 'desc')}</div>
    <div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.42 0.1 215);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px">${L(s, 'note')}</div>
  </div>`).join('');

document.getElementById('pm-pricing').innerHTML = PRICING_PLANS.map((pl) => `
  <a href="search.html?plan=${encodeURIComponent(pl.name)}" class="pm-card" style="display:block;border-radius:18px;padding:28px;text-decoration:none;color:inherit">
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">${L(pl, 'name')}</div>
    ${pl.originalPrice ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font:600 14px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${pl.originalPrice}</span>
      <span style="font:700 11px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 8px;border-radius:100px">${discountLabelText(pl.discountLabel)}</span>
    </div>` : ''}
    <div style="font:800 26px var(--pm-font-num);margin-bottom:4px">¥${pl.price}</div>
    <div style="font:11px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">${t('profile.taxIncluded')}</div>
    <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:16px">${L(pl, 'desc')}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;background:var(--pm-brand-grad);color:#fff;border-radius:10px;padding:12px;font:700 13px var(--pm-font-body)">${t('profile.bookThisPlan')}</div>
  </a>`).join('');

document.getElementById('pm-safety').innerHTML = SAFETY_POINTS.map((s) => `
  <div class="pm-card" style="padding:24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="width:28px;height:28px;flex-shrink:0;border-radius:8px;background:oklch(0.94 0.05 200);color:oklch(0.4 0.14 200);display:flex;align-items:center;justify-content:center;font:700 14px var(--pm-font-num)">✓</span>
      <span style="font:700 15px var(--pm-font-body)">${L(s, 'title')}</span>
    </div>
    <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3)">${L(s, 'desc')}</div>
  </div>`).join('');

// 季節のおすすめロケーション：エリアのタブ（名古屋／岐阜）＋季節ごとのカード。今の季節のカードを強調する。
{
  const tabsEl = document.getElementById('pm-location-tabs');
  const gridEl = document.getElementById('pm-locations');
  const nowSeason = seasonForMonth(Number(jstDateIso().slice(5, 7))).key;
  const spotHtml = (spot) => {
    const season = SEASONS.find((s) => s.key === spot.season);
    const now = spot.season === nowSeason;
    const name = L(spot, 'name');
    return `
    <div class="pm-card pm-loc-card${now ? ' is-now' : ''}" data-season="${spot.season}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="pm-loc-season"><span aria-hidden="true">${season.icon}</span>${L(season, 'label')}　${L(season, 'range')}</span>
        ${now ? `<span class="pm-loc-now">${t('top.locations.now')}</span>` : ''}
      </div>
      <div style="font:700 16px/1.5 var(--pm-font-body);margin-bottom:4px">${escapeHtml(name)}</div>
      ${spot.note ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">※${escapeHtml(L(spot, 'note'))}</div>` : ''}
      <div style="font:700 14px/1.7 var(--pm-font-body);color:oklch(0.35 0.03 235);margin:6px 0 6px">${escapeHtml(L(spot, 'catch'))}</div>
      <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:12px">${escapeHtml(L(spot, 'desc'))}</div>
      ${spot.access ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.42 0.1 215);background:var(--pm-bg-mint);border-radius:10px;padding:8px 10px;margin-bottom:12px">${escapeHtml(L(spot, 'access'))}</div>` : ''}
      <a href="${escapeHtml(spot.mapUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(tf('top.locations.mapAria', { name }))}" style="margin-top:auto;font:700 13px var(--pm-font-body);color:oklch(0.45 0.14 210);text-decoration:underline">${t('top.locations.map')} ↗</a>
    </div>`;
  };
  const show = (key) => {
    const area = SEASONAL_LOCATIONS.find((a) => a.key === key) || SEASONAL_LOCATIONS[0];
    tabsEl.querySelectorAll('.pm-loc-tab').forEach((b) => {
      const on = b.dataset.area === area.key;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    gridEl.setAttribute('aria-labelledby', `pm-loc-tab-${area.key}`);
    gridEl.innerHTML = area.spots.map(spotHtml).join('');
    const areaLink = document.getElementById('pm-loc-area-link');
    areaLink.href = `${area.key}.html`;
    areaLink.textContent = tf('top.locations.areaLink', { area: L(area, 'label') });
  };
  tabsEl.innerHTML = SEASONAL_LOCATIONS.map((a) => `
    <button type="button" role="tab" class="pm-loc-tab" id="pm-loc-tab-${a.key}" data-area="${a.key}" aria-controls="pm-locations">${L(a, 'label')}</button>`).join('');
  const tabs = [...tabsEl.querySelectorAll('.pm-loc-tab')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => show(b.dataset.area));
    // 左右キーでタブを移動（WAI-ARIA のタブの操作）。
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      show(next.dataset.area);
      next.focus();
    });
  });
  show(SEASONAL_LOCATIONS[0].key);

  // ヒーロー下の案内：今の季節のスポット（エリアごとに1つ）を並べ、上のセクションへ誘導する。
  const band = document.getElementById('pm-loc-band');
  band.dataset.season = nowSeason;
  band.innerHTML = `
    <span class="pm-loc-band-title">${t('top.locBand.title')}</span>
    <span class="pm-loc-band-spots">
      ${SEASONAL_LOCATIONS.map((a) => {
        const spot = a.spots.find((s) => s.season === nowSeason);
        return spot ? `<span class="pm-loc-band-spot">${escapeHtml(L(spot, 'name'))}<small>${escapeHtml(L(a, 'label'))}</small></span>` : '';
      }).join('')}
    </span>
    <a class="pm-loc-band-link" href="#locations-section">${t('top.locBand.link')} ↓</a>`;
}

// <details>/<summary> gives keyboard (Enter/Space, Tab) and screen-reader
// support for free — the previous clickable <div> had neither.
const faqEl = document.getElementById('pm-faqs');
faqEl.innerHTML = FAQS.map((f) => `
  <details class="pm-card pm-faq-item" style="border-radius:14px;overflow:hidden">
    <summary class="pm-faq-q">
      <span style="font:700 15px var(--pm-font-body);color:oklch(0.28 0.02 240)">${L(f, 'q')}</span>
      <span class="pm-faq-icon" style="font:600 18px var(--pm-font-num);color:oklch(0.6 0.12 210);flex-shrink:0"></span>
    </summary>
    <div style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);padding:0 20px 18px">${L(f, 'a')}</div>
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
