import { mountLayout } from '../layout.js';
import { getPhotographer, getPlans, getReviews } from '../repo.js';

mountLayout();

const params = new URLSearchParams(location.search);
const id = params.get('id') || 'p1';

function starsLabel(stars) { return '★★★★★☆☆☆☆☆'.slice(5 - stars, 10 - stars); }

(async () => {
  try {
    const [photographer, plans, reviews] = await Promise.all([
      getPhotographer(id), getPlans(id), getReviews(id),
    ]);

    document.getElementById('pm-loading').remove();
    const profileEl = document.getElementById('pm-profile');
    profileEl.style.display = 'flex';

    document.getElementById('pm-header-block').innerHTML = `
      ${photographer.photo_url
        ? `<div style="width:120px;height:120px;flex-shrink:0;border-radius:50%;background-image:url(${photographer.photo_url});background-size:cover;background-position:center;box-shadow:0 10px 26px oklch(0.7 0.06 220 / 0.18)"></div>`
        : `<div style="width:120px;height:120px;flex-shrink:0;border-radius:50%;background:repeating-linear-gradient(135deg, oklch(0.9 0.05 200) 0px, oklch(0.9 0.05 200) 10px, oklch(0.96 0.03 210) 10px, oklch(0.96 0.03 210) 20px);display:flex;align-items:center;justify-content:center"><span style="font:10px ui-monospace,monospace;color:oklch(0.4 0.08 210)">PHOTO</span></div>`}
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <h1 style="font:700 28px var(--pm-font-body);margin:0">${photographer.name}</h1>
          <span class="pm-badge">審査済カメラマン</span>
        </div>
        <div style="font:14px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">${photographer.area || ''}</div>
        <div style="display:flex;align-items:center;gap:6px;font:14px var(--pm-font-body);color:oklch(0.4 0.02 235)">
          <span style="color:var(--pm-star)">★</span>${photographer.rating ?? '-'}<span style="color:var(--pm-text-muted)">（${photographer.reviews_count ?? 0}件）</span>
        </div>
      </div>`;

    document.getElementById('pm-bio').textContent = photographer.bio || '';
    document.getElementById('pm-price-comment').textContent = photographer.price_comment || '';
    document.getElementById('pm-availability').textContent = photographer.availability_label || '';
    document.getElementById('pm-rating-line').innerHTML = `<span style="color:var(--pm-star)">★</span>${photographer.rating ?? '-'}（${photographer.reviews_count ?? 0}件のレビュー）`;
    document.getElementById('pm-book-btn').href = `booking.html?id=${photographer.id}`;

    document.getElementById('pm-plans').innerHTML = plans.map((plan, idx) => `
      <a href="booking.html?id=${photographer.id}&plan=${idx}" class="pm-card" style="display:block;border-radius:14px;padding:16px;text-decoration:none;color:inherit">
        <div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">${plan.name}</div>
        ${plan.original_price ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="font:600 12px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${plan.original_price.toLocaleString()}</span>
          <span style="font:700 10px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 7px;border-radius:100px">${plan.discount_label || ''}</span>
        </div>` : ''}
        <div style="font:700 18px var(--pm-font-body);margin-bottom:2px">¥${plan.price.toLocaleString()}<span style="font:11px var(--pm-font-body);color:var(--pm-text-3)">（税込）</span></div>
        <div style="font:12px/1.6 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:12px">${plan.description || ''}</div>
        <div style="text-align:center;background:var(--pm-bg-mint);color:oklch(0.42 0.13 210);border-radius:8px;padding:9px;font:700 12px var(--pm-font-body)">このプランで予約</div>
      </a>`).join('') || '<div class="pm-empty">プラン情報がありません。</div>';

    document.getElementById('pm-reviews').innerHTML = reviews.map((rv) => `
      <div style="border:1px solid var(--pm-border-soft);border-radius:14px;padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font:600 13px var(--pm-font-body)">${rv.reviewer_name}</span>
          <span style="font:13px var(--pm-font-body);color:var(--pm-star)">${starsLabel(rv.stars)}</span>
        </div>
        <div style="font:13px/1.7 var(--pm-font-body);color:oklch(0.45 0.02 235)">${rv.comment || ''}</div>
      </div>`).join('') || '<div class="pm-empty">まだレビューはありません。</div>';
  } catch (err) {
    document.getElementById('pm-loading').textContent = 'カメラマン情報の取得に失敗しました。';
    console.error(err);
  }
})();
