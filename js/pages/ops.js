import { mountLayout } from '../layout.js';
import { requireRole, signOut, getSession } from '../auth.js';
import {
  getGuaranteeClaimsForReview, reviewGuaranteeClaim,
  getMonitorApplicationsForReview, reviewMonitorApplication,
  getPayoutCandidates, getGuaranteeClaimsForBookings, releasePayouts, getMonitorSlotsLeft, getBankAccountsForPhotographers,
  createPhotographerAccount, resetPhotographerPassword, markNoShow, getPhotographersForReview, setPhotographerVisibility,
  getReviewsForModeration, setReviewHidden,
  getBookingsForOps, getBookingsNeedingAttention, opsCancelBooking, markRefunded, setPayoutHold,
} from '../repo.js';
import {
  AREAS, EXTRA_OPTIONS, OPS_CANCEL_REASONS, RESCHEDULABLE_STATUSES, photographerPayoutFor, noShowQuote, jstDateIso, addDaysToIso,
  guaranteeBlocksPayout, guaranteeClaimDeadline, MONITOR_CAPACITY,
} from '../data.js';
import { mountRescheduleModal } from '../rescheduleModal.js';
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
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">申込み：${(claim.applied_at || '').slice(0, 10)} ・ 申請可能日：${claim.eligible_at}〜${guaranteeClaimDeadline(claim)}${claim.reshoot_booking_id ? ' ・ 再撮影：予約済み' : (claim.status === 'approved' ? ' ・ 再撮影：お客様の日程選択待ち' : '')}</div>
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
  const accepted = apps.filter((a) => a.status === 'accepted' || a.status === 'completed').length;
  document.getElementById('pm-monitor-capacity').textContent = `当選 ${accepted} / 定員 ${MONITOR_CAPACITY}名${accepted >= MONITOR_CAPACITY ? '（定員に達しました）' : `（残り ${MONITOR_CAPACITY - accepted}名）`}`;
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
      const note = prompt('当選連絡コメント（応募者に表示されます。任意）', '当選です！通常の予約ページから撮影日をお選びください。モニター価格はお支払い画面で自動で適用されます。');
      if (note === null) return;
      btn.disabled = true;
      try {
        const result = await reviewMonitorApplication(btn.dataset.appId, 'accepted', note);
        if (!result.emailed) alert('記録しましたが、応募者へのメールは送れませんでした。応募者に直接ご連絡ください。');
        loadMonitorApplications();
      } catch (err) {
        alert(err.message || '更新に失敗しました。');
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
        const result = await reviewMonitorApplication(btn.dataset.appId, 'rejected', note);
        if (!result.emailed) alert('記録しましたが、応募者へのメールは送れませんでした。応募者に直接ご連絡ください。');
        loadMonitorApplications();
      } catch (err) {
        alert(err.message || '更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
}

// ---------- システム状態 ----------
// Asks /api/status what the deployed Functions can see. If the request itself
// fails (empty 404/405, HTML error page), the API isn't being served at all —
// typically because the domain still points at a static-only deployment.
const STATUS_OK = 'color:oklch(0.45 0.13 160)';
const STATUS_NG = 'color:oklch(0.5 0.17 25)';

function statusRow(label, ok, text, hint) {
  return `<div style="display:flex;gap:10px;align-items:baseline;padding:4px 0">
    <span style="${ok ? STATUS_OK : STATUS_NG};font:700 13px var(--pm-font-body);width:16px">${ok ? '✓' : '✗'}</span>
    <div style="font:13px/1.7 var(--pm-font-body);flex:1;min-width:0"><b>${label}</b>：<span style="${ok ? STATUS_OK : STATUS_NG}">${text}</span>${!ok && hint ? `<div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3)">${hint}</div>` : ''}</div>
  </div>`;
}

async function loadSystemStatus() {
  const el = document.getElementById('pm-system-status');
  const title = '<div style="font:700 15px var(--pm-font-body);margin-bottom:6px">システム状態</div>';
  el.innerHTML = `${title}<div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">確認しています…</div>`;
  let res = null;
  let data = null;
  try {
    const session = await getSession();
    res = await fetch('/api/status', { headers: { Authorization: `Bearer ${session.access_token}` } });
    data = await res.json();
  } catch (e) { /* handled below */ }

  if (!data || !res || !res.ok || !data.ok) {
    const code = res ? `HTTP ${res.status}` : '接続できません';
    el.innerHTML = `${title}${statusRow('サイトのAPI', false, `応答がありません（${code}）`,
      'カメラマン登録・決済・予約キャンセル・通知メールなどが動きません。ドメイン（photo-match.jp）が、APIに対応した Cloudflare Pages のプロジェクトに向いているか、確認してください（古い「Workers」のままだと、APIは動きません）。')}`;
    return;
  }
  const rows = [
    statusRow('サイトのAPI', true, '動作しています'),
    data.supabase_service_role === 'ok'
      ? statusRow('データベースの管理キー', true, '有効')
      : statusRow('データベースの管理キー', false, data.supabase_service_role === 'missing' ? '未設定' : '無効（値が違う可能性）',
        'Cloudflare Pages の「変数とシークレット」に、SUPABASE_SERVICE_ROLE_KEY（Supabase の service_role キー）を設定し、再デプロイしてください。'),
    data.stripe_secret === 'test' || data.stripe_secret === 'live'
      ? statusRow('Stripe（決済）', true, data.stripe_secret === 'live' ? '本番モード' : 'テストモード（テストカードのみ決済できます）')
      : statusRow('Stripe（決済）', false, data.stripe_secret === 'missing' ? '未設定' : '無効（キーの値が違う可能性）', 'STRIPE_SECRET_KEY を設定してください。'),
    statusRow('Stripe の署名シークレット', data.stripe_webhook_secret === 'set', data.stripe_webhook_secret === 'set' ? '設定済み' : '未設定',
      'STRIPE_WEBHOOK_SECRET（whsec_…）を設定してください。未設定だと、決済しても予約が「支払い済み」になりません。'),
    data.resend_key === 'ok'
      ? statusRow('メール送信（Resend）', true, '有効')
      : statusRow('メール送信（Resend）', false, data.resend_key === 'missing' ? '未設定' : '無効（キーの値が違う可能性）', 'RESEND_API_KEY を設定してください。未設定だと、予約通知メールは送られません。'),
    statusRow('メールの送信元', data.email_from === 'set', data.email_from === 'set' ? '設定済み' : '未設定（初期値を使用）', 'EMAIL_FROM を「PhotoMatch &lt;no-reply@photo-match.jp&gt;」の形式で設定してください。'),
  ];
  el.innerHTML = title + rows.join('') + '<div style="font:11px var(--pm-font-body);color:var(--pm-text-muted);margin-top:6px">※設定の値は表示されません。変更した場合は、再デプロイ後に画面を再読み込みしてください。</div>';
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
    p.verified_at ? `<span style="${PILL};background:oklch(0.94 0.05 200);color:oklch(0.4 0.14 200)">本人確認・研修済み</span>`
      : `<span style="${PILL};background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)">本人確認・研修 未確認</span>`,
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
        // 「審査済」バッジの根拠。初めて公開するときは、本人確認と接客研修を終えているか確認する。
        const target = all.find((p) => p.id === btn.dataset.id);
        let verified = false;
        if (visible && target && !target.verified_at) {
          if (!confirm(`${btn.dataset.name}さんの「本人確認」と「接客研修」は完了していますか？\n完了している場合だけ OK を押してください（サイトに「審査済」と表示されます）。`)) return;
          verified = true;
        }
        btn.disabled = true;
        try {
          const res = await setPhotographerVisibility(btn.dataset.id, visible, verified);
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

// ---------- 口コミの管理 ----------
function reviewCardHtml(rv) {
  const stars = '★'.repeat(rv.stars) + '☆'.repeat(5 - rv.stars);
  return `
  <div class="pm-card" style="padding:16px 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font:700 14px var(--pm-font-body)">${escapeHtml(rv.photographers?.name || rv.photographer_id)}</span>
        <span style="color:var(--pm-star);font:13px var(--pm-font-body)">${stars}</span>
        ${rv.is_hidden ? `<span style="${PILL};background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)">非表示中</span>` : ''}
      </div>
      <span style="font:12px var(--pm-font-num);color:var(--pm-text-muted)">${escapeHtml(String(rv.created_at || '').slice(0, 10))}</span>
    </div>
    <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">投稿者の表示名：${escapeHtml(rv.reviewer_name)}</div>
    ${rv.comment ? `<div style="font:13px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:10px 12px;white-space:pre-wrap">${escapeHtml(rv.comment)}</div>` : '<div style="font:12px var(--pm-font-body);color:var(--pm-text-muted)">（コメントなし）</div>'}
    <div style="margin-top:10px">
      ${rv.is_hidden
        ? `<button data-id="${rv.id}" class="btn-review-show pm-btn-outline">再表示する</button>`
        : `<button data-id="${rv.id}" class="btn-review-hide pm-btn-danger-outline">非表示にする</button>`}
    </div>
  </div>`;
}

async function loadReviews() {
  const reviews = await getReviewsForModeration(50);
  const el = document.getElementById('pm-reviews-admin');
  el.innerHTML = reviews.length ? reviews.map(reviewCardHtml).join('') : '<div class="pm-empty">投稿された口コミはまだありません。</div>';
  const bind = (selector, hidden, confirmText) => {
    el.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(confirmText)) return;
        btn.disabled = true;
        try {
          await setReviewHidden(btn.dataset.id, hidden);
          await loadReviews();
        } catch (err) {
          alert(err.message || '更新に失敗しました。');
          console.error(err);
          btn.disabled = false;
        }
      });
    });
  };
  bind('.btn-review-hide', true, 'この口コミを非表示にします。カメラマンのページから消え、評価の集計にも入らなくなります。よろしいですか？');
  bind('.btn-review-show', false, 'この口コミを再表示します。よろしいですか？');
}

// A shoot is paid out after the guarantee window; a same-day cancellation
// compensation (no shoot, nothing to guarantee) right away.
function eligiblePayoutDate(b) {
  const d = new Date(`${b.booking_date}T00:00:00`);
  if (b.status !== 'canceled') d.setDate(d.getDate() + GUARANTEE_WINDOW_DAYS);
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
    const amount = photographerPayoutFor(b);
    const optionCount = (b.options || []).length;
    const what = b.status === 'canceled'
      ? '当日キャンセル補償'
      : `${escapeHtml(b.plan_name || '')}${optionCount ? `＋オプション${optionCount}件` : ''}`;
    // Lateness can only be judged once the shoot has started; until its
    // payout is sent, ops can still turn it into a same-day cancellation.
    const noShow = noShowQuote(b).allowed
      ? ` <button data-booking-id="${b.id}" class="btn-no-show" style="background:none;border:none;padding:0 0 0 6px;font:700 11px var(--pm-font-body);color:var(--pm-warn-text);text-decoration:underline;cursor:pointer">遅刻キャンセルにする</button>`
      : '';
    return `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">・${b.booking_date} ${String(b.start_time || '').slice(0, 5)}　${what}　依頼者：${escapeHtml(b.customer_name || '-')}　¥${amount.toLocaleString()}${b.payout_hold ? `　<b style="color:var(--pm-warn-text)">送金保留中（${escapeHtml(b.payout_hold_reason || '')}）</b>` : ''}${b.status !== 'canceled' && !b.delivered_at ? '　<b style="color:var(--pm-warn-text)">未納品</b>' : ''}${noShow}</div>`;
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
    group.total += photographerPayoutFor(b);
  });
  return [...map.values()];
}

async function loadPayouts() {
  // ¥0 の無料再撮影は送金の対象外。
  const bookings = (await getPayoutCandidates()).filter((b) => photographerPayoutFor(b) > 0);
  const claimsByBooking = await getGuaranteeClaimsForBookings(bookings.map((b) => b.id));
  const today = new Date();
  const ready = [];
  const waiting = [];
  bookings.forEach((b) => {
    const claim = claimsByBooking[b.id];
    // 申請中、または申込み済みで申請期限前は送金しない（functions/_lib/payouts.js と同じ判定）。
    const disputed = b.status !== 'canceled' && guaranteeBlocksPayout(claim);
    const pastWindow = today >= eligiblePayoutDate(b);
    // A shoot is paid out only once the photos were delivered.
    const delivered = b.status === 'canceled' || !!b.delivered_at;
    (pastWindow && !disputed && !b.payout_hold && delivered ? ready : waiting).push(b);
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

  const bookingsById = Object.fromEntries(bookings.map((b) => [b.id, b]));
  [readyEl, waitingEl].forEach((el) => el.querySelectorAll('.btn-no-show').forEach((btn) => {
    btn.addEventListener('click', () => handleNoShow(bookingsById[btn.dataset.bookingId], btn, () => { loadPayouts(); loadBookings(); }));
  }));

  readyEl.querySelectorAll('.btn-payout-release').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ids = btn.dataset.bookingIds.split(',');
      const total = Number(btn.dataset.total).toLocaleString();
      if (!confirm(`${ids.length}件・合計¥${total}を銀行振込済みとして記録します（実際の振込は別途行ってください）。よろしいですか？`)) return;
      btn.disabled = true;
      try {
        const res = await releasePayouts(ids, '月次バッチ（月末締め・翌月25日払い）');
        const failed = res.results.filter((r) => !r.ok);
        if (failed.length) alert(`${res.released}件を記録しました。${failed.length}件は記録できませんでした：\n${failed.map((f) => `・${f.error}`).join('\n')}`);
        else alert(`${res.released}件を振込済みとして記録し、カメラマンにメールでお知らせしました。`);
        loadPayouts();
      } catch (err) {
        alert(err.message || '更新に失敗しました。');
        console.error(err);
        btn.disabled = false;
      }
    });
  });
}

// 遅刻キャンセル（送金一覧と予約の管理の両方から使う）。
async function handleNoShow(b, btn, after) {
  const q = noShowQuote(b);
  if (!q.allowed) return;
  const yen = (n) => `¥${n.toLocaleString()}`;
  const note = prompt(
    `${b.booking_date} ${String(b.start_time).slice(0, 5)}〜 ${b.customer_name || ''} 様の予約を、遅刻（15分以上）による当日キャンセルとして処理します。\n\n`
    + `キャンセル料：${yen(q.fee)}\nお客様への返金（オプション分）：${yen(q.refund)}\nカメラマンへの報酬：${yen(photographerPayoutFor(b))} → 補償 ${yen(q.photographerComp)}\n\n`
    + 'お客様・カメラマンにメールで通知されます。取り消しはできません。\nメモ（任意。遅刻の状況など）を入力してOKを押してください。',
    '',
  );
  if (note === null) return;
  btn.disabled = true;
  try {
    const result = await markNoShow(b.id, note);
    if (result.refund_status === 'failed') alert('処理しましたが、自動返金に失敗しました。Stripe の管理画面から手動で返金してください。');
    after();
  } catch (err) {
    alert(err.message || '遅刻キャンセルの処理に失敗しました。');
    console.error(err);
    btn.disabled = false;
  }
}

// ---- 予約の管理 ----
const reschedModal = mountRescheduleModal(document.getElementById('pm-ops-resched-mount'));
const OPS_STATUS = { pending_payment: '決済待ち', paid: '確定', confirmed: '確定', requested: '依頼中', completed: '完了', canceled: 'キャンセル済' };
const CANCEL_REASON_LABEL = { customer: 'お客様がキャンセル', no_show: '遅刻キャンセル', system: '決済の取り消し（自動）', ops: '運営がキャンセル' };
const REFUND_LABEL = { none: '返金なし', pending: '返金処理中', succeeded: '返金済み', failed: '自動返金に失敗' };
const GENDER_LABEL = { male: '男性', female: '女性', other: '回答しない' };
const yen = (n) => `¥${Number(n || 0).toLocaleString()}`;

function opsBookingCardHtml(b) {
  const optionLabels = (b.options || []).map((o) => (EXTRA_OPTIONS.find((x) => x.key === o.key) || {}).label).filter(Boolean);
  const active = RESCHEDULABLE_STATUSES.includes(b.status) || b.status === 'pending_payment';
  const canAct = b.payout_status !== 'released';
  const actions = [];
  if (canAct && RESCHEDULABLE_STATUSES.includes(b.status)) actions.push(`<button data-id="${b.id}" class="btn-ops-resched pm-btn-outline">日程変更</button>`);
  if (canAct && active) actions.push(`<button data-id="${b.id}" class="btn-ops-cancel pm-btn-danger-outline">キャンセル（返金）</button>`);
  if (noShowQuote(b).allowed) actions.push(`<button data-id="${b.id}" class="btn-ops-noshow pm-btn-danger-outline">遅刻キャンセル</button>`);
  if (b.status === 'canceled' && ['failed', 'pending'].includes(b.refund_status)) actions.push(`<button data-id="${b.id}" class="btn-ops-refunded pm-btn-outline">手動で返金済みにする</button>`);
  if (b.payout_hold) actions.push(`<button data-id="${b.id}" class="btn-ops-unhold pm-btn-outline">送金の保留を解除</button>`);
  else if (canAct && b.status !== 'canceled') actions.push(`<button data-id="${b.id}" class="btn-ops-hold pm-btn-outline" style="font-size:11px">送金を保留</button>`);
  const reasons = [
    b.status === 'canceled' ? `${CANCEL_REASON_LABEL[b.cancel_reason] || 'キャンセル'}${b.cancel_note ? `：${escapeHtml(b.cancel_note)}` : ''}` : '',
    b.status === 'canceled' && b.refund_status ? `${REFUND_LABEL[b.refund_status] || b.refund_status} ${yen(b.refund_amount)}` : '',
    b.payout_hold ? `<b style="color:var(--pm-warn-text)">送金保留：${escapeHtml(b.payout_hold_reason || '')}</b>` : '',
    b.refund_status === 'failed' ? '<b style="color:var(--pm-warn-text)">Stripeで手動返金が必要</b>' : '',
    b.rescheduled_count ? `日程変更 ${b.rescheduled_count}回（変更前：${b.previous_booking_date} ${String(b.previous_start_time || '').slice(0, 5)}〜）` : '',
  ].filter(Boolean);
  return `
  <div class="pm-card" style="padding:14px 18px" data-booking-row="${b.id}">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="min-width:0;font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3)">
        <div style="font:700 14px var(--pm-font-body);color:oklch(0.3 0.02 235)">${b.booking_date} ${String(b.start_time).slice(0, 5)}〜${String(b.end_time).slice(0, 5)}　${escapeHtml(b.photographer_name)}
          <span style="${PILL};margin-left:6px;background:oklch(0.94 0.04 210);color:oklch(0.4 0.1 220)">${OPS_STATUS[b.status] || escapeHtml(b.status)}</span></div>
        <div>依頼者：${escapeHtml(b.customer_name || '-')}（${escapeHtml(b.customer_contact || '-')}）${b.customer_gender ? ` ・ ${GENDER_LABEL[b.customer_gender] || ''}` : ''}</div>
        <div>${escapeHtml(b.plan_name || '')}${b.monitor_application_id ? '（モニター価格）' : ''}${optionLabels.length ? ` ＋ ${optionLabels.map(escapeHtml).join('、')}` : ''} ・ 合計 ${yen(b.total_price)} ・ ${escapeHtml(b.area || '')}</div>
        ${reasons.length ? `<div>${reasons.join(' ／ ')}</div>` : ''}
      </div>
      ${actions.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">${actions.join('')}</div>` : ''}
    </div>
    <div class="ops-cancel-form" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint)">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;font:12px var(--pm-font-body)">
        <label>理由<br><select class="pm-select cancel-reason" style="width:auto">${Object.entries(OPS_CANCEL_REASONS).map(([k, v]) => `<option value="${k}">${v.replace(/により.*$/, '').replace('ため', '')}</option>`).join('')}</select></label>
        <label>返金額（円）<br><input class="pm-input cancel-refund" type="number" min="0" max="${b.status === 'pending_payment' ? 0 : b.total_price}" value="${b.status === 'pending_payment' ? 0 : b.total_price}" style="width:120px"></label>
        <label style="flex:1;min-width:160px">メモ（任意・お客様へのメールに入ります）<br><input class="pm-input cancel-note" type="text" maxlength="200"></label>
        <button class="pm-btn-danger-outline btn-ops-cancel-run" data-id="${b.id}">キャンセルを実行</button>
      </div>
    </div>
  </div>`;
}

async function loadBookings() {
  const today = jstDateIso();
  const [list, attention] = await Promise.all([getBookingsForOps(addDaysToIso(today, -45)), getBookingsNeedingAttention()]);
  const visible = list.filter((b) => !(b.status === 'pending_payment' && Date.now() - new Date(b.created_at).getTime() > 60 * 60 * 1000));
  const upcoming = visible.filter((b) => b.booking_date >= today && b.status !== 'canceled');
  const recent = visible.filter((b) => b.booking_date < today || b.status === 'canceled').reverse();
  const all = [...attention, ...visible];
  const byId = Object.fromEntries(all.map((b) => [b.id, b]));
  const fill = (id, rows, empty) => {
    document.getElementById(id).innerHTML = rows.length ? rows.map(opsBookingCardHtml).join('') : `<div class="pm-empty">${empty}</div>`;
  };
  fill('pm-bookings-attention', attention, '対応が必要な予約はありません。');
  fill('pm-bookings-upcoming', upcoming, '今後の予約はありません。');
  fill('pm-bookings-recent', recent, '過去45日の撮影・キャンセルはありません。');

  const refresh = () => { loadBookings().catch(console.error); loadPayouts().catch(console.error); };
  const each = (cls, fn) => document.querySelectorAll(`#pm-bookings-attention .${cls}, #pm-bookings-upcoming .${cls}, #pm-bookings-recent .${cls}`)
    .forEach((btn) => btn.addEventListener('click', () => fn(byId[btn.dataset.id], btn)));

  each('btn-ops-resched', (b) => reschedModal.open(b, refresh, { asOps: true }));
  each('btn-ops-noshow', (b, btn) => handleNoShow(b, btn, refresh));
  each('btn-ops-cancel', (b, btn) => {
    const form = btn.closest('[data-booking-row]').querySelector('.ops-cancel-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });
  each('btn-ops-cancel-run', async (b, btn) => {
    const row = btn.closest('[data-booking-row]');
    const reason = row.querySelector('.cancel-reason').value;
    const refund = Number(row.querySelector('.cancel-refund').value);
    const note = row.querySelector('.cancel-note').value.trim();
    if (!confirm(`${b.booking_date} ${String(b.start_time).slice(0, 5)}〜 ${b.customer_name || ''} 様の予約をキャンセルします。\n\n理由：${OPS_CANCEL_REASONS[reason]}\nお客様への返金：${yen(refund)}（支払い ${yen(b.status === 'pending_payment' ? 0 : b.total_price)}）\nカメラマンへの報酬：なし\n\nお客様・カメラマンにメールで通知されます。取り消しはできません。よろしいですか？`)) return;
    btn.disabled = true;
    try {
      const result = await opsCancelBooking(b.id, refund, reason, note);
      if (result.refund_status === 'failed') alert('キャンセルしましたが、自動返金に失敗しました。Stripe の管理画面から手動で返金し、「手動で返金済みにする」を押してください。');
      refresh();
    } catch (err) {
      alert(err.message || 'キャンセルに失敗しました。');
      btn.disabled = false;
    }
  });
  each('btn-ops-refunded', async (b, btn) => {
    const note = prompt('Stripe の管理画面で返金したことを記録します。お客様のマイページの表示が「返金済み」になります。\nメモ（任意）を入力してOKを押してください。', '');
    if (note === null) return;
    btn.disabled = true;
    try { await markRefunded(b.id, note); refresh(); } catch (err) { alert(err.message || '更新に失敗しました。'); btn.disabled = false; }
  });
  each('btn-ops-unhold', async (b, btn) => {
    if (!confirm(`この予約のカメラマンへの送金の保留を解除します（理由：${b.payout_hold_reason || '-'}）。確認は済みましたか？`)) return;
    btn.disabled = true;
    try { await setPayoutHold(b.id, false); refresh(); } catch (err) { alert(err.message || '更新に失敗しました。'); btn.disabled = false; }
  });
  each('btn-ops-hold', async (b, btn) => {
    const reason = prompt('この予約のカメラマンへの送金を保留にします。理由を入力してください。', '');
    if (reason === null) return;
    btn.disabled = true;
    try { await setPayoutHold(b.id, true, reason || '運営が保留'); refresh(); } catch (err) { alert(err.message || '更新に失敗しました。'); btn.disabled = false; }
  });
}

async function load() {
  const profile = await requireRole('ops', 'ops-login.html');
  if (!profile) return;

  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-ops').style.display = 'block';

  loadSystemStatus();
  // Each section loads on its own, so one failing (e.g. a column missing
  // before schema.sql was re-run) doesn't leave the rest of the page empty.
  const section = async (name, fn) => {
    try { await fn(); } catch (err) { console.error(`${name} failed`, err); }
  };
  await section('予約の管理', loadBookings);
  await section('掲載管理', loadListings);
  await section('口コミ', loadReviews);
  await section('モニター', loadMonitorApplications);
  await section('送金', loadPayouts);

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
      const note = prompt('承認すると、お客様に「マイページから再撮影の日程を選んでください」とメールが届き、カメラマンにも知らせます。\n承認コメント（お客様へのメールとマイページに表示されます。任意）', '');
      if (note === null) return;
      btn.disabled = true;
      try {
        await reviewGuaranteeClaim(btn.dataset.claimId, 'approved', note);
        load();
      } catch (err) {
        alert(err.message || '更新に失敗しました。');
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
        alert(err.message || '更新に失敗しました。');
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

document.getElementById('photographer-reset-btn').addEventListener('click', async () => {
  const btn = document.getElementById('photographer-reset-btn');
  const errorEl = document.getElementById('photographer-reset-error');
  const resultEl = document.getElementById('photographer-reset-result');
  const credsEl = document.getElementById('photographer-reset-creds');
  const emailEl = document.getElementById('f-reset-email');
  const email = emailEl.value.trim();
  errorEl.style.display = 'none';
  resultEl.style.display = 'none';
  if (!email) {
    errorEl.textContent = 'メールアドレスを入力してください。';
    errorEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  try {
    const data = await resetPhotographerPassword(email);
    credsEl.innerHTML = `メール：${escapeHtml(data.email)}<br>新しい仮パスワード：${escapeHtml(data.password)}`;
    resultEl.style.display = 'block';
    emailEl.value = '';
  } catch (err) {
    errorEl.textContent = err.message || 'パスワードの再発行に失敗しました。';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});

load().catch((err) => {
  document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
  console.error(err);
});
