import { mountLayout } from '../layout.js';
import { listPhotographers } from '../repo.js';

mountLayout();

const STRIPE_BG = 'repeating-linear-gradient(135deg, oklch(0.9 0.05 200) 0px, oklch(0.9 0.05 200) 12px, oklch(0.96 0.03 210) 12px, oklch(0.96 0.03 210) 24px)';

function cardHtml(p) {
  const photoStyle = p.photo_url
    ? `aspect-ratio:4/3;background-image:url(${p.photo_url});background-size:cover;background-position:center`
    : `aspect-ratio:4/3;background:${STRIPE_BG};display:flex;align-items:center;justify-content:center;text-align:center;padding:10px`;
  return `
  <a href="profile.html?id=${p.id}" class="pm-card" style="display:block;overflow:hidden;text-decoration:none;color:inherit">
    <div style="${photoStyle}">
      ${p.photo_url ? '' : `<span style="font:11px ui-monospace,monospace;color:oklch(0.4 0.08 210)">PHOTO — ${p.name}</span>`}
    </div>
    <div style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${p.name}</span>
        <span class="pm-badge">審査済</span>
      </div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">${p.area || ''}</div>
      <div style="display:flex;align-items:center;gap:6px;font:13px var(--pm-font-body);color:oklch(0.4 0.02 235);margin-bottom:8px">
        <span style="color:var(--pm-star)">★</span>${p.rating ?? '-'}<span style="color:var(--pm-text-muted)">（${p.reviews_count ?? 0}件）</span>
      </div>
      <div style="border-top:1px solid var(--pm-border-faint);padding-top:10px">
        <div style="font:13px/1.6 var(--pm-font-body);color:oklch(0.4 0.03 220);margin-bottom:6px">${p.price_comment || ''}</div>
        <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${p.availability_label || ''}</span>
      </div>
    </div>
  </a>`;
}

(async () => {
  try {
    const photographers = await listPhotographers();
    document.getElementById('pm-loading').remove();
    document.getElementById('pm-result-count').textContent = `${photographers.length}件のカメラマンが見つかりました`;
    document.getElementById('pm-results').innerHTML = photographers.map(cardHtml).join('') || '<div class="pm-empty">カメラマンが見つかりませんでした。</div>';
  } catch (err) {
    document.getElementById('pm-loading').textContent = 'カメラマン情報の取得に失敗しました。Supabaseの接続設定（js/config.js）をご確認ください。';
    console.error(err);
  }
})();
