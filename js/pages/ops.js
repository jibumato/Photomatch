import { mountLayout } from '../layout.js';
import { requireRole, signOut } from '../auth.js';
import { getGuaranteeClaimsForReview, reviewGuaranteeClaim } from '../repo.js';

mountLayout();

const CLAIM_STATUS_LABEL = { applied: '申込み済み', claimed: '審査待ち', approved: '承認済み', rejected: '却下' };
const CLAIM_STATUS_STYLE = {
  '申込み済み': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  '審査待ち': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '承認済み': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '却下': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
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

async function load() {
  const profile = await requireRole('ops', 'ops-login.html');
  if (!profile) return;

  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-ops').style.display = 'block';

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

load().catch((err) => {
  document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
  console.error(err);
});
