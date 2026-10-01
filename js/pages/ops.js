import { mountLayout } from '../layout.js';
import { requireRole, signOut } from '../auth.js';
import {
  getGuaranteeClaimsForReview, reviewGuaranteeClaim,
  getMonitorApplicationsForReview, reviewMonitorApplication,
  getPayoutCandidates, getGuaranteeClaimsForBookings, releasePayout, getBankAccountsForPhotographers,
  createPhotographerAccount, getPhotographersForReview, setPhotographerVisibility,
} from '../repo.js';
import { AREAS, PHOTOGRAPHER_PAYOUT_RATE } from '../data.js';
import { safePhotoUrl } from '../util.js';

const GUARANTEE_WINDOW_DAYS = 30;

mountLayout();

const CLAIM_STATUS_LABEL = { applied: '申込み済み', claimed: '審査待ち', approved: '承認済み', rejected: '却下' };
const CLAIM_STATUS_STYLE = {
  '申込み済み': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  '審査待ち': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '承認済み': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '却下': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
};

const MONITOR_STATUS_LABEL = { applied: '審査待ち', accepted: '当選', rejected: '落選', completed: '撮影完了' };
const MONITOR_STATUS_STYLE = {
  '審査待ち': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '当選': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '落選': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
  '撮影完了': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function claimCardHtml(claim, { pending }) {
  const booking = claim.bookings || {};
  const photographerName = booking.photographers?.name || booking.photographer_id || '-';
  const statusLabel = CLAIM_STATUS_LABEL[claim.status] || claim.status;
  return `
  <div class="pm-card" style="padding:18px 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:10px">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font:700 15px var(--pm-font-body)">${escapeHtml(booking.customer_name || '依頼者')}</span>
          <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${CLAIM_STATUS_STYLE[statusLabel] || ''}">${statusLabel}</span>
        </div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">連絡先：${escapeHtml(booking.customer_contact || '-')}</div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">カメラマン：${escapeHtml(photographerName)} ・ ${booking.plan_name || ''} ・ 撮影日 ${booking.booking_date || '-'}</div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">申込み：${(claim.applied_at || '').slice(0, 10)} ・ 申請可能日：${claim.eligible_at}</div>
      </div>
    </div>
    ${claim.claim_note ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px;margin-bottom:10px">申請内容：${escapeHtml(claim.claim_note)}</div>` : ''}
    ${claim.review_note ? `<div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:10px">審査コメント：${escapeHtml(claim.review_note)}</div>` : ''}
    ${pending ? `
    <div style="display:flex;gap:8px">
      <button data-claim-id="${claim.id}" class="btn-approve" style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 18px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer">承認する</button>
      <button data-claim-id="${claim.id}" class="btn-reject pm-btn-danger-outline">却下する</button>
    </div>` : ''}
  </div>`;
}

function monitorCardHtml(app, { pending }) {
  const applicant = app.profiles || {};
  const statusLabel = MONITOR_STATUS_LABEL[app.status] || app.status;
  return `
  <div class="pm-card" style="padding:18px 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:10px">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font:700 15px var(--pm-font-body)">${escapeHtml(applicant.name || '応募者')}</span>
          <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${MONITOR_STATUS_STYLE[statusLabel] || ''}">${statusLabel}</span>
        </div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">連絡先：${escapeHtml(applicant.email || '-')}</div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">既存写真：${app.has_existing_photos ? 'あり' : 'なし'} ・ 使用アプリ：${escapeHtml(app.current_apps || '-')} ・ 追跡調査：${app.follow_up_opt_in ? '協力可' : '未回答'}</div>
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">応募日：${(app.applied_at || '').slice(0, 10)}</div>
      </div>
    </div>
    ${app.motivation ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px;margin-bottom:10px">応募理由：${escapeHtml(app.motivation)}</div>` : ''}
    ${app.review_note ? `<div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:10px">審査コメント：${escapeHtml(app.review_note)}</div>` : ''}
    ${pending ? `
    <div style="display:flex;gap:8px">
      <button data-app-id="${app.id}" class="btn-monitor-accept" style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 18px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer">当選にする</button>
      <button data-app-id="${app.id}" class="btn-monitor-reject pm-btn-danger-outline">落選にする</button>
    </div>` : ''}
  </div>`;
}

async function loadMonitorApplications() {
  const apps = await getMonitorApplicationsForReview();
  const pending = apps.filter((a) => a.status === 'applied');
  const others = apps.filter((a) => a.status !== 'applied');

  const pendingEl = document.getElementById('pm-monitor-pending');
  pendingEl.innerHTML = pending.length
    ? pending.map((a) => monitorCardHtml(a, { pending: true })).join('')
    : '<div class="pm-empty">現在、審査待ちの応募はありません。</div>';

  const othersEl = document.getElementById('pm-monitor-others');
  othersEl.innerHTML = others.length
    ? others.map((a) => monitorCardHtml(a, { pending: false })).join('')
    : '<div class="pm-empty">対象データがありません。</div>';

  pendingEl.querySelectorAll('.btn-monitor-accept').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const note = prompt('当選連絡コメント（応募者に表示されます。任意）', '当選です！通常の予約フローから撮影日をお選びください。');
      if (note === null) return;
      btn.disabled = true;
      try {
        await reviewMonitorApplication(btn.dataset.appId, 'accepted', note);
        loadMonitorApplications();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
  pendingEl.querySelectorAll('.btn-monitor-reject').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const note = prompt('落選理由（応募者に表示されます。任意）', '今回は定員に達したため見送りとなりました。');
      if (note === null) return;
      btn.disabled = true;
      try {
        await reviewMonitorApplication(btn.dataset.appId, 'rejected', note);
        loadMonitorApplications();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
}

// ---------- カメラマンの掲載管理 ----------
// Mirrors the server-side check in functions/api/photographers/visibility.js
// (which is the one that actually enforces it).
function missingForApproval(p) {
  const missing = [];
  if (!p.photo_url) missing.push('プロフィール写真');
  if (!p.name || !p.name.trim()) missing.push('表示名');
  if (!AREAS.some((a) => a.label === p.area)) missing.push('活動エリア');
  if (!p.gender) missing.push('性別');
  if (!p.bio || !p.bio.trim()) missing.push('紹介文');
  return missing;
}

const PILL = 'padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap';

function listingCardHtml(p) {
  const live = p.is_visible !== false;
  const missing = missingForApproval(p);
  const photo = safePhotoUrl(p.photo_url);
  const gender = p.gender === 'female' ? '女性' : p.gender === 'male' ? '男性' : '未設定';
  const pills = [
    live ? `<span style="${PILL};background:oklch(0.94 0.06 160);color:oklch(0.4 0.12 160)">公開中</span>`
      : `<span style="${PILL};background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)">非公開</span>`,
    p.is_paused ? `<span style="${PILL};background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)">本人が休止中</span>` : '',
    p.speaks_english ? `<span style="${PILL};background:oklch(0.94 0.05 245);color:oklch(0.42 0.14 250)">英語対応</span>` : '',
  ].join('');
  const action = live
    ? `<button data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name || '')}" class="btn-listing-hide pm-btn-danger-outline">掲載を停止する</button>`
    : `<button data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name || '')}" class="btn-listing-approve" ${missing.length ? 'disabled' : ''} style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 18px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer;${missing.length ? 'opacity:0.45;cursor:not-allowed' : ''}">承認して公開する</button>`;
  return `
  <div class="pm-card" style="padding:18px 20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
    <div style="width:96px;aspect-ratio:4/3;border-radius:10px;flex-shrink:0;${photo
      ? `background-image:url(${photo});background-size:cover;background-position:center`
      : 'background:var(--pm-bg-mint);display:flex;align-items:center;justify-content:center;font:11px var(--pm-font-body);color:var(--pm-text-3)'}">${photo ? '' : '写真なし'}</div>
    <div style="flex:1;min-width:220px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${escapeHtml(p.name || '（未設定）')}</span>${pills}
      </div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${escapeHtml(p.area || '未設定')} ・ ${gender} ・ 料金プラン ${p.planCount}件${p.instagram ? ` ・ Instagram @${escapeHtml(p.instagram)}` : ''}</div>
      ${p.price_comment ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.02 235);margin-top:6px">ひとこと：${escapeHtml(p.price_comment)}</div>` : ''}
      ${p.bio ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px;margin-top:8px;white-space:pre-wrap">${escapeHtml(p.bio)}</div>` : ''}
      ${!live && missing.length ? `<div class="pm-error-text" style="margin-top:8px">未入力：${missing.join('・')}（本人に入力を依頼してください）</div>` : ''}
      ${!live && !missing.length && !p.planCount ? '<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:8px">公開すると、標準の4プランを登録します。</div>' : ''}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${action}
        <a href="profile.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" class="pm-btn-outline" style="text-decoration:none;display:inline-block">プロフィールを見る</a>
      </div>
    </div>
  </div>`;
}

async function loadListings() {
  const all = await getPhotographersForReview();
  const pending = all.filter((p) => p.is_visible === false);
  const live = all.filter((p) => p.is_visible !== false);

  const pendingEl = document.getElementById('pm-listing-pending');
  pendingEl.innerHTML = pending.length ? pending.map(listingCardHtml).join('') : '<div class="pm-empty">公開待ちのカメラマンはいません。</div>';
  const liveEl = document.getElementById('pm-listing-live');
  liveEl.innerHTML = live.length ? live.map(listingCardHtml).join('') : '<div class="pm-empty">公開中のカメラマンはいません。</div>';

  const bind = (selector, visible, confirmText) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled || !confirm(confirmText(btn.dataset.name))) return;
        btn.disabled = true;
        try {
          const res = await setPhotographerVisibility(btn.dataset.id, visible);
          if (res.plansAdded) alert(`標準の料金プランを${res.plansAdded}件登録しました。`);
          await loadListings();
        } catch (err) {
          alert(err.message || '更新に失敗しました。');
          console.error(err);
          btn.disabled = false;
        }
      });
    });
  };
  bind('.btn-listing-approve', true, (name) => `${name}さんを公開します。検索ページ・プロフィールページに表示され、予約を受け付けるようになります。よろしいですか？`);
  bind('.btn-listing-hide', false, (name) => `${name}さんの掲載を停止します。検索ページに表示されなくなり、新規の予約を受け付けなくなります（本人は再開できません）。よろしいですか？`);
}

function eligiblePayoutDate(bookingDate) {
  const d = new Date(`${bookingDate}T00:00:00`);
  d.setDate(d.getDate() + GUARANTEE_WINDOW_DAYS);
  return d;
}

function bankAccountLineHtml(account) {
  if (!account) return '<div class="pm-error-text" style="margin:10px 0">振込先口座が未登録です。カメラマンに登録を依頼してください。</div>';
  const typeLabel = account.account_type === 'checking' ? '当座' : '普通';
  return `<div style="font:12px/1.8 var(--pm-font-body);color:oklch(0.4 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px;margin:10px 0">
    振込先：${escapeHtml(account.bank_name)} ${escapeHtml(account.branch_name)} ${typeLabel} ${escapeHtml(account.account_number)}　名義：${escapeHtml(account.account_holder_name)}
  </div>`;
}

// カメラマンごとにまとめて表示・送金する（銀行振込は1件ずつより合算1回の方が
// 手数料・手間の両面で現実的なため）。
function payoutGroupHtml(group, { ready }) {
  const bookingLines = group.items.map((b) => {
    const amount = Math.round(b.total_price * PHOTOGRAPHER_PAYOUT_RATE);
    return `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">・${b.booking_date}　${escapeHtml(b.plan_name || '')}　依頼者：${escapeHtml(b.customer_name || '-')}　¥${amount.toLocaleString()}</div>`;
  }).join('');
  return `
  <div class="pm-card" style="padding:18px 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:8px">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font:700 15px var(--pm-font-body)">${escapeHtml(group.photographerName)}</span>
          <span style="font:700 14px var(--pm-font-num);color:oklch(0.4 0.14 200)">合計 ¥${group.total.toLocaleString()}（${group.items.length}件）</span>
        </div>
      </div>
    </div>
    ${ready ? bankAccountLineHtml(group.bankAccount) : ''}
    <div style="margin-bottom:10px">${bookingLines}</div>
    ${ready ? `
    <div style="display:flex;gap:8px">
      <button data-photographer-id="${group.photographerId}" data-booking-ids="${group.items.map((b) => b.id).join(',')}" data-total="${group.total}" class="btn-payout-release" ${group.bankAccount ? '' : 'disabled'} style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 18px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer">まとめて振込済みにする</button>
    </div>` : ''}
  </div>`;
}

function groupByPhotographer(bookings, bankAccounts) {
  const map = new Map();
  bookings.forEach((b) => {
    const key = b.photographer_id;
    if (!map.has(key)) {
      map.set(key, {
        photographerId: key,
        photographerName: b.photographers?.name || key,
        bankAccount: bankAccounts[key] || null,
        items: [],
        total: 0,
      });
    }
    const group = map.get(key);
    group.items.push(b);
    group.total += Math.round(b.total_price * PHOTOGRAPHER_PAYOUT_RATE);
  });
  return [...map.values()];
}

async function loadPayouts() {
  const bookings = await getPayoutCandidates();
  const claimsByBooking = await getGuaranteeClaimsForBookings(bookings.map((b) => b.id));
  const today = new Date();
  const ready = [];
  const waiting = [];
  bookings.forEach((b) => {
    const claim = claimsByBooking[b.id];
    const disputed = claim && claim.status === 'claimed';
    const pastWindow = today >= eligiblePayoutDate(b.booking_date);
    (pastWindow && !disputed ? ready : waiting).push(b);
  });

  const photographerIds = [...new Set([...ready, ...waiting].map((b) => b.photographer_id))];
  const bankAccounts = await getBankAccountsForPhotographers(photographerIds);
  const readyGroups = groupByPhotographer(ready, bankAccounts);
  const waitingGroups = groupByPhotographer(waiting, bankAccounts);

  const readyEl = document.getElementById('pm-payout-ready');
  readyEl.innerHTML = readyGroups.length
    ? readyGroups.map((g) => payoutGroupHtml(g, { ready: true })).join('')
    : '<div class="pm-empty">現在、送金可能な予約はありません。</div>';

  const waitingEl = document.getElementById('pm-payout-waiting');
  waitingEl.innerHTML = waitingGroups.length
    ? waitingGroups.map((g) => payoutGroupHtml(g, { ready: false })).join('')
    : '<div class="pm-empty">対象データがありません。</div>';

  readyEl.querySelectorAll('.btn-payout-release').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ids = btn.dataset.bookingIds.split(',');
      const total = Number(btn.dataset.total).toLocaleString();
      if (!confirm(`${ids.length}件・合計¥${total}を銀行振込済みとして記録します（実際の振込は別途行ってください）。よろしいですか？`)) return;
      btn.disabled = true;
      try {
        for (const id of ids) {
          await releasePayout(id, '月次バッチ（月末締め・翌月25日払い）');
        }
        loadPayouts();
      } catch (err) {
        alert(err.message || '更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
}

async function load() {
  const profile = await requireRole('ops', 'ops-login.html');
  if (!profile) return;

  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-ops').style.display = 'block';

  await loadListings();
  await loadMonitorApplications();
  await loadPayouts();

  const claims = await getGuaranteeClaimsForReview();
  const pending = claims.filter((c) => c.status === 'claimed');
  const others = claims.filter((c) => c.status !== 'claimed');

  const pendingEl = document.getElementById('pm-pending');
  pendingEl.innerHTML = pending.length
    ? pending.map((c) => claimCardHtml(c, { pending: true })).join('')
    : '<div class="pm-empty">現在、審査待ちの申請はありません。</div>';

  const othersEl = document.getElementById('pm-others');
  othersEl.innerHTML = others.length
    ? others.map((c) => claimCardHtml(c, { pending: false })).join('')
    : '<div class="pm-empty">対象データがありません。</div>';

  pendingEl.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const note = prompt('承認コメント（依頼者に表示されます。任意）', '担当より別途チャットで再撮影日程をご連絡します。');
      if (note === null) return;
      btn.disabled = true;
      try {
        await reviewGuaranteeClaim(btn.dataset.claimId, 'approved', note);
        load();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
  pendingEl.querySelectorAll('.btn-reject').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const note = prompt('却下理由（依頼者に表示されます）');
      if (note === null) return;
      btn.disabled = true;
      try {
        await reviewGuaranteeClaim(btn.dataset.claimId, 'rejected', note);
        load();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.href = 'index.html';
});

document.getElementById('photographer-create-btn').addEventListener('click', async () => {
  const btn = document.getElementById('photographer-create-btn');
  const errorEl = document.getElementById('photographer-create-error');
  const resultEl = document.getElementById('photographer-create-result');
  const credsEl = document.getElementById('photographer-create-creds');
  const nameEl = document.getElementById('f-photographer-name');
  const emailEl = document.getElementById('f-photographer-email');
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  errorEl.style.display = 'none';
  resultEl.style.display = 'none';
  if (!name || !email) {
    errorEl.textContent = '名前とメールアドレスを入力してください。';
    errorEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  try {
    const data = await createPhotographerAccount(name, email);
    credsEl.innerHTML = `メール：${escapeHtml(data.email)}<br>仮パスワード：${escapeHtml(data.password)}`;
    resultEl.style.display = 'block';
    loadListings().catch((err) => console.error(err));
    nameEl.value = '';
    emailEl.value = '';
  } catch (err) {
    errorEl.textContent = err.message || 'アカウント作成に失敗しました。';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});

load().catch((err) => {
  document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
  console.error(err);
});
