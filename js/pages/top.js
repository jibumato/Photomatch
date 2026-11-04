import { mountLayout } from '../layout.js';
import {
  STATS, TARGET_PAINS, TARGET_PAINS_EN, SUPPORTED_APPS, SUPPORTED_APPS_EN,
  TESTIMONIALS, PRICING_PLANS, SAFETY_POINTS, FAQS, HOW_IT_WORKS,
  SEASONS, SEASONAL_LOCATIONS, seasonForMonth, jstDateIso, SLOT_TIMES, EVENING_START_TIME,
  perPhotoPrice, minPerPhotoPrice, minPlanPrice, DISCOUNT_CAMPAIGN,
} from '../data.js';
import { getLang, L, t, tf, discountLabelText } from '../i18n.js';
import { escapeHtml } from '../util.js';
import { observeReveal, slideTabIndicator } from '../motion.js';

mountLayout({ ctaKey: 'top.cta.see' });

document.getElementById('pm-stats').innerHTML = STATS.map((s) => `
  <div class="pm-card pm-stat" data-reveal="zoom" style="text-align:center;padding:28px 16px">
    <div data-count style="font:800 clamp(36px,9vw,44px) var(--pm-font-num);background:linear-gradient(120deg, oklch(0.6 0.15 200), oklch(0.55 0.15 245));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">${s.value}</div>
    <span class="pm-stat-bar" aria-hidden="true"></span>
    <div style="font:13px var(--pm-font-body);color:var(--pm-text-3)">${L(s, 'label')}</div>
  </div>`).join('');

// Hero keeps a one-line version of the stats so the trust signal is still
// seen by people who leave before the full 実績 section further down.
document.getElementById('pm-hero-proof').innerHTML = STATS.map((s) => `
  <span style="white-space:nowrap">${L(s, 'label')} <b data-count data-count-delay="900" style="font:800 15px var(--pm-font-num);color:oklch(0.45 0.14 210)">${s.value}</b></span>`).join('<span style="color:var(--pm-text-muted);margin:0 10px">／</span>')
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
    <figure data-reveal="left" style="margin:0 0 clamp(8px,3vw,20px)">
      <div style="font:800 10px/1 var(--pm-font-num);letter-spacing:0.14em;color:var(--pm-text-muted);margin-bottom:8px">BEFORE</div>
      <img src="${before.src}" alt="${L(before, 'alt')}" width="720" height="960" loading="lazy" style="display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:10px;transform:rotate(-3deg);box-shadow:0 4px 12px oklch(0.3 0.02 235 / 0.15);border:4px solid #fff">
    </figure>
    <figure data-reveal="zoom" style="--i:3;margin:0;position:relative">
      <img src="${after.src}" alt="${L(after, 'alt')}" width="720" height="960" loading="lazy" style="display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:16px;box-shadow:0 0 0 3px #fff,0 0 0 6px oklch(0.7 0.13 205),0 18px 40px oklch(0.55 0.15 220 / 0.35)">
      <figcaption style="position:absolute;left:12px;top:12px;padding:6px 14px;border-radius:100px;background:var(--pm-brand-grad);color:#fff;font:800 13px/1.3 var(--pm-font-num);letter-spacing:0.12em;box-shadow:0 4px 12px oklch(0.5 0.15 220 / 0.35)">AFTER</figcaption>
      ${badge ? `<span class="pm-like-badge" data-reveal="pop" style="--i:9">${badge}</span>` : ''}
      <span aria-hidden="true" class="pm-voice-arrow" data-reveal="pop" style="--i:6;position:absolute;left:0;top:50%;transform:translate(-62%,-50%);display:flex;align-items:center;justify-content:center;width:clamp(34px,9vw,46px);height:clamp(34px,9vw,46px);border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 clamp(16px,4vw,20px)/1 var(--pm-font-num);box-shadow:0 0 0 4px #fff,0 6px 16px oklch(0.5 0.15 220 / 0.35)">→</span>
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

// 3ステップのタイムライン（線が伸びて番号が順番に出る）。下のカードと同じ内容なので読み上げからは外している。
document.getElementById('pm-flow').innerHTML = HOW_IT_WORKS.map((s) => `
  <li><span class="pm-flow-num">${s.step}</span><span class="pm-flow-label">${L(s, 'flow')}<small>${L(s, 'flowSub')}</small></span></li>`).join('');

document.getElementById('pm-steps').innerHTML = HOW_IT_WORKS.map((s) => `
  <div class="pm-card" style="padding:26px 24px;position:relative">
    ${s.img ? `<img src="${s.img}" alt="" style="width:100%;aspect-ratio:900/484;object-fit:cover;border-radius:12px;margin-bottom:16px">` : ''}
    <div style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 15px var(--pm-font-num);margin-bottom:14px">${s.step}</div>
    <div style="font:700 16px var(--pm-font-body);margin-bottom:8px">${L(s, 'title')}</div>
    <div style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:14px">${L(s, 'desc')}</div>
    <div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.42 0.1 215);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px">${L(s, 'note')}</div>
  </div>`).join('');

// 1枚あたりの価格（いちばん安いプラン）を、ヒーロー・料金のボタン・画面下のバーに出す。
{
  const per = minPerPhotoPrice().toLocaleString();
  document.getElementById('pm-hero-per-photo').textContent = tf('top.hero.perPhoto', { price: per });
  document.getElementById('pm-cta-note-pricing').textContent = tf('top.ctaNote.pricing', { price: per });
  document.getElementById('pm-sticky-price').innerHTML = `
    <span class="pm-sticky-cta-total-label" style="color:var(--pm-warn-text);font-weight:700">${t('top.sticky.off')}</span>
    <span class="pm-sticky-cta-total-value">¥${minPlanPrice().toLocaleString()}<small style="font:700 11px var(--pm-font-body)">〜</small></span>
    <span class="pm-sticky-cta-total-label">${tf('top.sticky.sub', { price: per })}</span>`;
}

// 割引と、その理由（ラベル・期間は DISCOUNT_CAMPAIGN に入れたときだけ出す）。
{
  const c = DISCOUNT_CAMPAIGN;
  const title = escapeHtml(L(c, 'title')).replace(/([\d,]+)/, '<b>$1</b>');
  const html = `<div class="pm-campaign">
    ${L(c, 'label') ? `<span class="pm-campaign-label">${escapeHtml(L(c, 'label'))}</span>` : ''}
    <div class="pm-campaign-title">${title}</div>
    <div class="pm-campaign-reason">${escapeHtml(L(c, 'reason'))}</div>
    ${L(c, 'until') ? `<div class="pm-campaign-until">${escapeHtml(L(c, 'until'))}</div>` : ''}
  </div>`;
  document.getElementById('pm-campaign-hero').innerHTML = html;
  document.getElementById('pm-campaign-pricing').innerHTML = html;
}

document.getElementById('pm-pricing').innerHTML = PRICING_PLANS.map((pl) => `
  <a href="search.html?plan=${encodeURIComponent(pl.name)}" class="pm-card pm-plan-card${pl.featured ? ' is-featured' : ''}" style="display:block;border-radius:18px;padding:28px;text-decoration:none;color:inherit">
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">${L(pl, 'name')}</div>
    ${pl.originalPrice ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font:600 14px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${pl.originalPrice}</span>
      <span style="font:700 11px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 8px;border-radius:100px">${discountLabelText(pl.discountLabel)}</span>
    </div>` : ''}
    <div class="pm-plan-price-row">
      <div>
        <div style="font:800 26px var(--pm-font-num);margin-bottom:4px"><span data-count data-count-duration="1100">¥${pl.price}</span></div>
        <div style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${t('profile.taxIncluded')}</div>
      </div>
      <div class="pm-plan-per"><span>${t('top.pricing.perPhoto')}</span><b>¥${perPhotoPrice(pl).toLocaleString()}</b></div>
    </div>
    <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:8px 0 12px">${L(pl, 'desc')}</div>
    ${pl.recommend ? `<div class="pm-plan-rec"><div class="pm-plan-rec-title">${t('top.pricing.recommend')}</div><ul>${L(pl, 'recommend').map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
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
  // 開始時刻で撮影場所が変わることを示す時間帯バー（昼＝季節のスポット／17時以降＝固定エリア）。
  const timeEl = document.getElementById('pm-loc-time');
  const hm = (s) => s.replace(/^0/, '');
  const firstStart = SLOT_TIMES[0];
  const lastDayStart = SLOT_TIMES[SLOT_TIMES.indexOf(EVENING_START_TIME) - 1];
  const dayEnd = '22:00';
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const nightShare = (toMin(dayEnd) - toMin(EVENING_START_TIME)) / (toMin(dayEnd) - toMin(firstStart));
  const timeHtml = (area) => {
    const nowSpot = area.spots.find((s) => s.season === seasonForMonth(Number(jstDateIso().slice(5, 7))).key);
    const ev = area.evening;
    return `
    <div class="pm-loc-time-label">${t('top.locations.time.label')}</div>
    <div class="pm-loc-time-bar" aria-hidden="true" style="--night:${(nightShare * 100).toFixed(2)}%">
      <span class="is-day"></span><span class="is-night"></span>
    </div>
    <div class="pm-loc-time-axis" aria-hidden="true" style="--night:${(nightShare * 100).toFixed(2)}%">
      <span>${hm(firstStart)}</span><span class="is-split">${hm(EVENING_START_TIME)}</span><span>${hm(dayEnd)}</span>
    </div>
    <div class="pm-loc-time-cards">
      <div class="pm-loc-time-card is-day">
        <span class="pm-loc-time-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg></span>
        <div>
          <div class="pm-loc-time-title">${tf('top.locations.time.dayTitle', { from: hm(firstStart), to: hm(lastDayStart) })}</div>
          <div class="pm-loc-time-text">${t('top.locations.time.dayText')}</div>
          ${nowSpot ? `<div class="pm-loc-time-sub">${tf('top.locations.time.dayNow', { spot: escapeHtml(L(nowSpot, 'name')) })}</div>` : ''}
        </div>
      </div>
      <div class="pm-loc-time-card is-night">
        <span class="pm-loc-time-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg></span>
        <div>
          <div class="pm-loc-time-title">${tf('top.locations.time.nightTitle', { from: hm(EVENING_START_TIME) })}</div>
          <div class="pm-loc-time-text">${tf('top.locations.time.nightText', { place: escapeHtml(L(ev, 'place')) })}</div>
          <div class="pm-loc-time-sub">${tf('top.locations.time.nightMeet', { meet: escapeHtml(L(ev, 'meet')) })}</div>
        </div>
      </div>
    </div>`;
  };
  const nowSeason = seasonForMonth(Number(jstDateIso().slice(5, 7))).key;
  const spotHtml = (spot) => {
    const season = SEASONS.find((s) => s.key === spot.season);
    const now = spot.season === nowSeason;
    const name = L(spot, 'name');
    return `
    <div class="pm-card pm-loc-card${now ? ' is-now' : ''}" data-season="${spot.season}">
      ${spot.img ? `<img class="pm-loc-photo" src="${escapeHtml(spot.img)}" alt="${escapeHtml(L(spot, 'imgAlt'))}" width="1200" height="800" loading="lazy">` : ''}
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
    slideTabIndicator(tabsEl);
    gridEl.setAttribute('aria-labelledby', `pm-loc-tab-${area.key}`);
    gridEl.innerHTML = area.spots.map(spotHtml).join('');
    timeEl.innerHTML = timeHtml(area);
    observeReveal(gridEl.parentElement);
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
    // 出し入れは .is-off で下へすべらせる（css/components.css）
    bar.classList.add('is-off');
    bar.style.display = '';
    const update = () => { bar.classList.toggle('is-off', Boolean(heroVisible.size || finalVisible.size)); };
    new IntersectionObserver(([e]) => { e.isIntersecting ? heroVisible.add(1) : heroVisible.delete(1); update(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { e.isIntersecting ? finalVisible.add(1) : finalVisible.delete(1); update(); }).observe(finalCta);
  }
}

observeReveal();
