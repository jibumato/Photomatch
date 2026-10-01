import { mountLayout } from '../layout.js';
import { getPhotographer, getPlans, getReviews, isBookable } from '../repo.js';
import { t, areaText, availabilityText, localizedField, planNameText, planDescText, reviewsCountLabel, taxIncludedSuffix } from '../i18n.js';
import { escapeHtml, safePhotoUrl, hasRating } from '../util.js';

mountLayout();

const params = new URLSearchParams(location.search);
const id = params.get('id') || 'p1';

function starsLabel(stars) { return '★★★★★☆☆☆☆☆'.slice(5 - stars, 10 - stars); }

// Only render handles that match Instagram's own username rules, so a typo or
// stray characters in the DB can't produce a broken or injected link.
function instagramLinkHtml(raw) {
  const handle = String(raw || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return '';
  return `<a href="https://www.instagram.com/${handle}/" target="_blank" rel="noopener noreferrer"
    style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;font:600 13px var(--pm-font-body);color:oklch(0.45 0.14 210);text-decoration:none">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/></svg>
    Instagram @${handle}
  </a>`;
}

(async () => {
  try {
    const [photographer, plans, reviews] = await Promise.all([
      getPhotographer(id), getPlans(id), getReviews(id),
    ]);

    document.getElementById('pm-loading').remove();
    const profileEl = document.getElementById('pm-profile');
    profileEl.style.display = 'flex';

    const photoUrl = safePhotoUrl(photographer.photo_url);
    document.getElementById('pm-header-block').innerHTML = `
      ${photoUrl
        ? `<div style="width:120px;height:120px;flex-shrink:0;border-radius:50%;background-image:url(${photoUrl});background-size:cover;background-position:center;box-shadow:0 10px 26px oklch(0.7 0.06 220 / 0.18)"></div>`
        : `<div style="width:120px;height:120px;flex-shrink:0;border-radius:50%;background:repeating-linear-gradient(135deg, oklch(0.9 0.05 200) 0px, oklch(0.9 0.05 200) 10px, oklch(0.96 0.03 210) 10px, oklch(0.96 0.03 210) 20px);display:flex;align-items:center;justify-content:center"><span style="font:10px ui-monospace,monospace;color:oklch(0.4 0.08 210)">PHOTO</span></div>`}
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <h1 style="font:700 28px var(--pm-font-body);margin:0">${escapeHtml(photographer.name)}</h1>
          <span class="pm-badge">${t('profile.badge.verified')}</span>
          ${photographer.speaks_english ? `<span class="pm-badge" style="background:oklch(0.94 0.05 245);color:oklch(0.42 0.14 250)">${t('profile.badge.english')}</span>` : ''}
        </div>
        <div style="font:14px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">${escapeHtml(areaText(photographer.area) || '')}</div>
        ${hasRating(photographer) ? `<div style="display:flex;align-items:center;gap:6px;font:14px var(--pm-font-body);color:oklch(0.4 0.02 235)">
          <span style="color:var(--pm-star)">★</span>${photographer.rating}<span style="color:var(--pm-text-muted)">${reviewsCountLabel(photographer.reviews_count)}</span>
        </div>` : ''}
        ${instagramLinkHtml(photographer.instagram)}
      </div>`;

    document.getElementById('pm-bio').textContent = localizedField(photographer, 'bio', 'bio_en') || '';
    document.getElementById('pm-price-comment').textContent = localizedField(photographer, 'price_comment', 'price_comment_en') || '';
    document.getElementById('pm-availability').textContent = availabilityText(photographer.availability_label) || '';
    if (hasRating(photographer)) {
      document.getElementById('pm-rating-line').innerHTML = `<span style="color:var(--pm-star)">★</span>${photographer.rating}${reviewsCountLabel(photographer.reviews_count, true)}`;
    } else {
      document.getElementById('pm-rating-line').remove();
    }

    if (!isBookable(photographer)) {
      const bookBtn = document.getElementById('pm-book-btn');
      bookBtn.outerHTML = `<div class="pm-note-box" style="margin-bottom:10px">${t('profile.paused')}</div>`;
      document.getElementById('pm-plans').innerHTML = `<div class="pm-empty">${t('profile.paused')}</div>`;
    } else {
      document.getElementById('pm-book-btn').href = `booking.html?id=${photographer.id}`;
      document.getElementById('pm-plans').innerHTML = plans.map((plan, idx) => `
        <a href="booking.html?id=${photographer.id}&plan=${idx}" class="pm-card" style="display:block;border-radius:14px;padding:16px;text-decoration:none;color:inherit">
          <div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">${planNameText(plan.name)}</div>
          ${plan.original_price ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="font:600 12px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${plan.original_price.toLocaleString()}</span>
            <span style="font:700 10px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 7px;border-radius:100px">${plan.discount_label || ''}</span>
          </div>` : ''}
          <div style="font:700 18px var(--pm-font-body);margin-bottom:2px">¥${plan.price.toLocaleString()}<span style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${taxIncludedSuffix()}</span></div>
          <div style="font:12px/1.6 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:12px">${planDescText(plan.description) || ''}</div>
          <div style="text-align:center;background:var(--pm-bg-mint);color:oklch(0.42 0.13 210);border-radius:8px;padding:9px;font:700 12px var(--pm-font-body)">${t('profile.bookThisPlan')}</div>
        </a>`).join('') || `<div class="pm-empty">${t('profile.plansEmpty')}</div>`;
    }

    document.getElementById('pm-reviews').innerHTML = reviews.map((rv) => `
      <div style="border:1px solid var(--pm-border-soft);border-radius:14px;padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font:600 13px var(--pm-font-body)">${escapeHtml(rv.reviewer_name)}</span>
          <span style="font:13px var(--pm-font-body);color:var(--pm-star)">${starsLabel(rv.stars)}</span>
        </div>
        <div style="font:13px/1.7 var(--pm-font-body);color:oklch(0.45 0.02 235)">${escapeHtml(rv.comment || '')}</div>
      </div>`).join('') || `<div class="pm-empty">${t('profile.reviewsEmpty')}</div>`;
  } catch (err) {
    document.getElementById('pm-loading').textContent = t('profile.loadError');
    console.error(err);
  }
})();
