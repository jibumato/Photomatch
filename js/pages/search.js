import { mountLayout } from '../layout.js';
import { listPhotographers } from '../repo.js';
import { AREAS } from '../data.js';

mountLayout();

const STRIPE_BG = 'repeating-linear-gradient(135deg, oklch(0.9 0.05 200) 0px, oklch(0.9 0.05 200) 12px, oklch(0.96 0.03 210) 12px, oklch(0.96 0.03 210) 24px)';

const state = { all: [], area: '', femaleOnly: false, sort: 'recommended' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cardHtml(p) {
  const photoStyle = p.photo_url
    ? `aspect-ratio:4/3;background-image:url(${p.photo_url});background-size:cover;background-position:center`
    : `aspect-ratio:4/3;background:${STRIPE_BG};display:flex;align-items:center;justify-content:center;text-align:center;padding:10px`;
  return `
  <a href="profile.html?id=${encodeURIComponent(p.id)}" class="pm-card" style="display:block;overflow:hidden;text-decoration:none;color:inherit">
    <div style="${photoStyle}">
      ${p.photo_url ? '' : `<span style="font:11px ui-monospace,monospace;color:oklch(0.4 0.08 210)">PHOTO — ${escapeHtml(p.name)}</span>`}
    </div>
    <div style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${escapeHtml(p.name)}</span>
        <span class="pm-badge">審査済</span>
      </div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">${escapeHtml(p.area || '')}</div>
      <div style="display:flex;align-items:center;gap:6px;font:13px var(--pm-font-body);color:oklch(0.4 0.02 235);margin-bottom:8px">
        <span style="color:var(--pm-star)">★</span>${p.rating ?? '-'}<span style="color:var(--pm-text-muted)">（${p.reviews_count ?? 0}件）</span>
      </div>
      <div style="border-top:1px solid var(--pm-border-faint);padding-top:10px">
        <div style="font:13px/1.6 var(--pm-font-body);color:oklch(0.4 0.03 220);margin-bottom:6px">${escapeHtml(p.price_comment || '')}</div>
        <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${escapeHtml(p.availability_label || '')}</span>
      </div>
    </div>
  </a>`;
}

// Areas come from the listings themselves rather than the AREAS constant, so a
// photographer in an area the constant doesn't list (e.g. 尾張エリア) still gets
// a chip instead of being silently unreachable. Canonical areas sort first.
function areaOptions() {
  const canonical = AREAS.map((a) => a.label);
  const present = [...new Set(state.all.map((p) => p.area).filter(Boolean))];
  present.sort((a, b) => {
    const ia = canonical.indexOf(a); const ib = canonical.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'ja');
  });
  return present;
}

function applyFilters() {
  let list = state.all;
  if (state.area) list = list.filter((p) => p.area === state.area);
  if (state.femaleOnly) list = list.filter((p) => p.gender === 'female');
  if (state.sort === 'rating') list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else if (state.sort === 'reviews') list = [...list].sort((a, b) => (b.reviews_count ?? 0) - (a.reviews_count ?? 0));
  return list;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.area) params.set('area', state.area);
  if (state.femaleOnly) params.set('female', '1');
  if (state.sort !== 'recommended') params.set('sort', state.sort);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderChips() {
  const chips = [{ label: 'すべて', value: '' }, ...areaOptions().map((a) => ({ label: a, value: a }))];
  document.getElementById('pm-area-chips').innerHTML = chips.map((c) => `
    <span class="pm-chip pm-area-chip ${c.value === state.area ? 'is-active' : ''}" data-area="${escapeHtml(c.value)}">${escapeHtml(c.label)}</span>`).join('');
  document.querySelectorAll('.pm-area-chip').forEach((el) => {
    el.addEventListener('click', () => {
      state.area = el.dataset.area;
      renderChips();
      render();
    });
  });
}

function render() {
  const list = applyFilters();
  document.getElementById('pm-results-title').textContent = state.area ? `${state.area}のカメラマン` : 'カメラマンを探す';

  const conditions = [];
  if (state.femaleOnly) conditions.push('女性カメラマン');
  const suffix = conditions.length ? `（${conditions.join('・')}）` : '';
  document.getElementById('pm-result-count').textContent = `${list.length}件のカメラマンが見つかりました${suffix}`;

  document.getElementById('pm-results').innerHTML = list.length
    ? list.map(cardHtml).join('')
    : `<div class="pm-empty" style="grid-column:1/-1">
         条件に合うカメラマンが見つかりませんでした。<br>
         <span id="pm-reset" style="cursor:pointer;color:oklch(0.45 0.14 210);font-weight:700;text-decoration:underline">条件をリセットする</span>
       </div>`;

  const reset = document.getElementById('pm-reset');
  if (reset) {
    reset.addEventListener('click', () => {
      state.area = ''; state.femaleOnly = false; state.sort = 'recommended';
      document.getElementById('pm-female-only').checked = false;
      document.getElementById('pm-sort').value = 'recommended';
      renderChips();
      render();
    });
  }
  syncUrl();
}

(async () => {
  try {
    state.all = await listPhotographers();
    document.getElementById('pm-loading').style.display = 'none';

    const params = new URLSearchParams(location.search);
    const areaParam = params.get('area');
    if (areaParam && state.all.some((p) => p.area === areaParam)) state.area = areaParam;
    state.femaleOnly = params.get('female') === '1';
    const sortParam = params.get('sort');
    if (['rating', 'reviews'].includes(sortParam)) state.sort = sortParam;

    // The gender column ships in a later schema revision; if an install hasn't
    // run it yet every value is undefined, so hide the filter rather than
    // offering one that always returns zero results.
    const hasGenderData = state.all.some((p) => p.gender);
    if (!hasGenderData) {
      document.getElementById('pm-female-toggle').closest('div').style.display = 'none';
      state.femaleOnly = false;
    }

    document.getElementById('pm-female-only').checked = state.femaleOnly;
    document.getElementById('pm-sort').value = state.sort;

    document.getElementById('pm-female-only').addEventListener('change', (e) => {
      state.femaleOnly = e.target.checked;
      render();
    });
    document.getElementById('pm-sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });

    renderChips();
    render();
  } catch (err) {
    document.getElementById('pm-loading').textContent = 'カメラマン情報の取得に失敗しました。Supabaseの接続設定（js/config.js）をご確認ください。';
    console.error(err);
  }
})();
