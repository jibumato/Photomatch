import '../i18n/mypage.js';
import { t, tf, getLang, planNameText } from '../i18n.js';
import { mountLayout } from '../layout.js';
import { getSession, getProfile, signOut } from '../auth.js';
import {
  getMyBookings, cancelBooking, getMessageCounts, getReadTimestamps, getCounselingSheetsForBookings,
  getGuaranteeClaimsForBookings, getReceiptUrl, applyGuaranteeClaim, submitGuaranteeClaim, getMyReviewsByBooking, createReshoot,
} from '../repo.js';
import { mountChatModal } from '../chat.js';
import { mountSheetModal } from '../sheet.js';
import { mountReviewModal } from '../reviewModal.js';
import { mountRescheduleModal } from '../rescheduleModal.js';
import { cancellationQuote, rescheduleQuote, RESCHEDULE_DENIED_MESSAGE, RESCHEDULE_OPTION_KEY, jstDateIso, isValidDeliveryUrl, guaranteeClaimDeadline, PENDING_PAYMENT_HOLD_MIN, addDaysToIso } from '../data.js';

mountLayout();

const chatModal = mountChatModal(document.getElementById('pm-chat-mount'), { onClose: () => load() });
const sheetModal = mountSheetModal(document.getElementById('pm-sheet-mount'));
const reviewModal = mountReviewModal(document.getElementById('pm-review-mount'));
const reschedModal = mountRescheduleModal(document.getElementById('pm-resched-mount'));

const STATUS_STYLE = {
  paid: 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  confirmed: 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  requested: 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  completed: 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  canceled: 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
};
const STATUS_KEYS = ['pending_payment', 'paid', 'confirmed', 'requested', 'completed', 'canceled'];
const statusLabel = (status) => (STATUS_KEYS.includes(status) ? t('mypage.status.' + status) : status);
const yen = (n) => `¥${n.toLocaleString()}`;
const timeOf = (v) => String(v).slice(0, 5);
const noteSep = getLang() === 'en' ? ' · ' : ' ・ ';

// Japan time, so a shoot doesn't move to 「過去の予約」 at 9:00 the next morning.
function todayIso() { return jstDateIso(); }
const addDaysIso = addDaysToIso;
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const chatBtnHtml = (bookingId, unread) => `
  <button data-booking-id="${bookingId}" class="btn-chat" style="position:relative;display:flex;align-items:center;gap:6px;background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer;white-space:nowrap">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"></path></svg>
    ${t('mypage.btn.message')}
    ${unread.hasUnread ? `<span class="pm-unread-badge">${unread.unreadLabel}</span>` : ''}
  </button>`;

let reshootsById = {};

function guaranteeBlockHtml(b, claim) {
  if (b.status === 'canceled') return '';
  if (!claim) {
    return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint)">
      <button data-booking-id="${b.id}" data-date="${b.booking_date}" class="btn-guarantee-apply" style="background:#fff;border:1.5px solid oklch(0.86 0.03 215);border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:oklch(0.4 0.06 235);cursor:pointer">${t('mypage.gu.apply')}</button>
    </div>`;
  }
  const today = todayIso();
  const deadline = guaranteeClaimDeadline(claim);
  if (claim.status === 'applied') {
    if (today < claim.eligible_at) {
      return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);font:12px var(--pm-font-body);color:var(--pm-text-3)">${tf('mypage.gu.appliedWait', { from: claim.eligible_at, to: deadline })}</div>`;
    }
    if (today > deadline) {
      return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);font:12px var(--pm-font-body);color:var(--pm-text-3)">${tf('mypage.gu.expired', { deadline })}</div>`;
    }
    return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button data-claim-id="${claim.id}" class="btn-guarantee-claim" style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer">${t('mypage.gu.claimBtn')}</button>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${tf('mypage.gu.deadline', { deadline })}</span>
    </div>`;
  }
  if (claim.status === 'claimed') {
    return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);font:12px var(--pm-font-body);color:var(--pm-text-3)">${t('mypage.gu.prefix')}<span style="font-weight:700;color:oklch(0.5 0.13 75)">${t('mypage.gu.reviewing')}</span></div>`;
  }
  if (claim.status === 'approved') {
    const reshoot = claim.reshoot_booking_id && reshootsById[claim.reshoot_booking_id];
    const booked = reshoot && reshoot.status !== 'canceled';
    return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.14 200)">${t('mypage.gu.prefix')}<span style="font-weight:700">${t('mypage.gu.approved')}</span>${claim.review_note ? noteSep + escapeHtml(claim.review_note) : ''}
      ${booked
        ? `<div style="color:var(--pm-text-3)">${tf('mypage.gu.reshootBooked', { date: reshoot.booking_date, time: timeOf(reshoot.start_time) })}</div>`
        : `<div style="margin-top:8px"><button data-claim-id="${claim.id}" data-booking-id="${b.id}" class="btn-reshoot" style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer">${t('mypage.gu.pickReshoot')}</button></div>`}
    </div>`;
  }
  if (claim.status === 'rejected') {
    return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint);font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3)">${t('mypage.gu.prefix')}${t('mypage.gu.rejected')}${claim.review_note ? noteSep + escapeHtml(claim.review_note) : ''}</div>`;
  }
  return '';
}

// A review can be written once the shoot has finished (end time, JST) on a
// booking that wasn't canceled. The database enforces the same rule.
function isReviewable(b) {
  if (!['paid', 'confirmed', 'completed'].includes(b.status)) return false;
  return new Date(`${b.booking_date}T${b.end_time.slice(0, 8)}+09:00`) <= new Date();
}

function reviewBlockHtml(b, review) {
  if (!isReviewable(b)) return '';
  const wrap = 'margin-top:12px;padding-top:12px;border-top:1px solid var(--pm-border-faint)';
  if (!review) {
    return `<div style="${wrap};display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <span style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3)">${t('mypage.review.thanks')}</span>
      <button data-booking-id="${b.id}" class="btn-review" style="background:#fff;border:1.5px solid oklch(0.86 0.03 215);border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:oklch(0.4 0.06 235);cursor:pointer">${t('mypage.review.write')}</button>
    </div>`;
  }
  const filled = '★'.repeat(review.stars);
  const empty = '☆'.repeat(5 - review.stars);
  return `<div style="${wrap}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font:13px var(--pm-font-body);color:var(--pm-star)">${filled}<span style="color:oklch(0.85 0.01 220)">${empty}</span>
        <span style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-left:6px">${t('mypage.review.posted')}</span></div>
      <button data-booking-id="${b.id}" class="btn-review" style="background:none;border:none;font:700 12px var(--pm-font-body);color:oklch(0.45 0.14 210);text-decoration:underline;cursor:pointer">${t('mypage.review.edit')}</button>
    </div>
    ${review.comment ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.4 0.02 235);margin-top:6px;white-space:pre-wrap">${escapeHtml(review.comment)}</div>` : ''}
    ${review.is_hidden ? `<div style="font:11px var(--pm-font-body);color:oklch(0.5 0.13 75);margin-top:6px">${t('mypage.review.hidden')}</div>` : ''}
  </div>`;
}

function bookingCardHtml(b, meta, { history }) {
  const statusText = statusLabel(b.status);
  const cancellable = !history && b.status !== 'canceled' && b.status !== 'completed' && cancellationQuote(b).allowed;
  const priceLabel = b.reshoot_of ? t('mypage.freeReshoot') : tf('mypage.priceTaxIncl', { amount: b.total_price.toLocaleString() });

  const actions = [];
  if (!history) {
    actions.push(chatBtnHtml(b.id, meta));
    actions.push(`
      <button data-booking-id="${b.id}" class="btn-sheet" style="display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid oklch(0.86 0.03 215);border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:oklch(0.4 0.06 235);cursor:pointer;white-space:nowrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        ${meta.sheetDone ? t('mypage.btn.counselingDone') : t('mypage.btn.counseling')}
        ${meta.sheetDone ? '<span style="color:oklch(0.6 0.14 150);font:700 13px var(--pm-font-num)">✓</span>' : ''}
      </button>`);
    // 日程変更: 3日前まで誰でも無料。2日前からは「あんしん振替プラン」加入者の1回のみ。
    // 条件を満たさないときも、プラン加入者には理由が分かるようボタンは残す。
    const hasReschedulePlan = (b.options || []).some((o) => o.key === RESCHEDULE_OPTION_KEY);
    if (cancellable && (rescheduleQuote(b).allowed || hasReschedulePlan)) {
      actions.push(`<button data-booking-id="${b.id}" class="btn-reschedule" style="background:#fff;border:1.5px solid oklch(0.86 0.03 215);border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:oklch(0.4 0.06 235);cursor:pointer;white-space:nowrap">${t('mypage.btn.reschedule')}</button>`);
    }
    if (cancellable) actions.push(`<button data-booking-id="${b.id}" class="btn-cancel pm-btn-danger-outline">${t('mypage.btn.cancel')}</button>`);
  } else if (b.status !== 'canceled' && (!b.delivered_at || b.booking_date >= addDaysIso(todayIso(), -30) || (meta.guarantee && meta.guarantee.status === 'approved'))) {
    // After the shoot the customer can still message the photographer — about
    // delivery, or for 30 days after (and during a free reshoot).
    actions.push(chatBtnHtml(b.id, meta));
  }

  return `
  <div class="pm-card" style="padding:18px 20px;${history ? 'background:var(--pm-bg)' : ''}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font:700 15px var(--pm-font-body)">${escapeHtml(b.photographer_name)}</span>
          <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${STATUS_STYLE[b.status] || ''}">${statusText}</span>
        </div>
        <div style="font:13px var(--pm-font-body);color:oklch(0.45 0.02 235)">${tf('mypage.dateLine', { date: b.booking_date, start: timeOf(b.start_time), end: timeOf(b.end_time) })}</div>
        ${b.order_number ? `<div style="font:11px var(--pm-font-num);color:var(--pm-text-muted);margin-top:2px">${tf('mypage.orderNumber', { n: escapeHtml(b.order_number) })}</div>` : ''}
        <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${tf('mypage.planLine', { plan: escapeHtml(planNameText(b.plan_name)), price: priceLabel })}</div>
        ${b.total_price > 0 && b.status !== 'pending_payment' && !b.reshoot_of ? `<div style="margin-top:4px"><button type="button" class="btn-receipt" data-booking-id="${b.id}" style="background:none;border:0;padding:0;font:600 12px var(--pm-font-body);color:oklch(0.45 0.14 210);cursor:pointer;text-decoration:underline">${t('mypage.receipt.link')}</button></div>` : ''}
        ${b.delivered_at && isValidDeliveryUrl(b.delivery_url) && b.status !== 'canceled' ? `<div style="margin-top:6px"><a href="${escapeHtml(b.delivery_url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;font:700 13px var(--pm-font-body);color:oklch(0.45 0.14 210)">${t('mypage.delivery.link')}</a></div>` : ''}
        ${b.staff_pick_at && b.staff_pick_note && b.status !== 'canceled' ? `<div style="margin-top:6px;font:12px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);background:var(--pm-bg-mint);border-radius:10px;padding:8px 12px;white-space:pre-wrap"><b>${t('mypage.staffPick')}</b>\n${escapeHtml(b.staff_pick_note)}</div>` : ''}
        ${b.rescheduled_count > 0 && b.previous_booking_date && b.status !== 'canceled' ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${tf('mypage.rescheduledFrom', { date: b.previous_booking_date, time: timeOf(b.previous_start_time) })}</div>` : ''}
        ${b.status === 'canceled' && b.cancel_reason === 'no_show' ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${t('mypage.noShowNote')}</div>` : ''}
        ${b.status === 'canceled' && b.refund_amount > 0 ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${tf(b.refund_status === 'succeeded' ? 'mypage.refund.done' : 'mypage.refund.pending', { amount: b.refund_amount.toLocaleString() })}</div>` : ''}
      </div>
      ${actions.length ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${actions.join('')}</div>` : ''}
    </div>
    ${history ? guaranteeBlockHtml(b, meta.guarantee) : ''}
    ${reviewBlockHtml(b, meta.review)}
  </div>`;
}

function wireCardEvents(root, bookingsById) {
  // 領収書: open the window first (a popup blocker only allows it straight
  // from the click), then point it at Stripe's receipt page.
  root.querySelectorAll('.btn-receipt').forEach((el) => {
    el.addEventListener('click', async () => {
      const win = window.open('', '_blank');
      el.disabled = true;
      try {
        const url = await getReceiptUrl(el.dataset.bookingId);
        if (win) { win.opener = null; win.location.href = url; } else { location.href = url; }
      } catch (err) {
        if (win) win.close();
        alert(err.message || t('mypage.receipt.failed'));
      } finally {
        el.disabled = false;
      }
    });
  });
  root.querySelectorAll('.btn-chat').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      chatModal.open(b.id, 'client', b.photographer_name, tf('mypage.chatLabel', { date: b.booking_date, start: timeOf(b.start_time) }));
    });
  });
  root.querySelectorAll('.btn-sheet').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      sheetModal.open(b.id, tf('mypage.sheetLabel', { date: b.booking_date, start: timeOf(b.start_time), name: b.photographer_name }));
    });
  });
  root.querySelectorAll('.btn-cancel').forEach((el) => {
    el.addEventListener('click', async () => {
      const b = bookingsById[el.dataset.bookingId];
      const quote = cancellationQuote(b);
      if (!quote.allowed) {
        alert(t('mypage.cancel.started'));
        return;
      }
      const message = b.status === 'pending_payment'
        ? t('mypage.cancel.confirmUnpaid')
        : tf('mypage.cancel.confirm', { fee: yen(quote.fee), refund: yen(quote.refund) });
      if (!confirm(message)) return;
      el.disabled = true;
      try {
        const result = await cancelBooking(el.dataset.bookingId);
        if (result && result.refund > 0) {
          alert(result.refund_status === 'succeeded'
            ? tf('mypage.cancel.doneCard', { refund: yen(result.refund) })
            : tf('mypage.cancel.donePending', { refund: yen(result.refund) }));
        }
        load();
      } catch (err) {
        el.disabled = false;
        alert(err.message || t('mypage.cancel.failed'));
        console.error(err);
      }
    });
  });
  root.querySelectorAll('.btn-reschedule').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      const quote = rescheduleQuote(b);
      if (!quote.allowed) { alert(getLang() === 'en' ? t('mypage.reschedDenied.' + (RESCHEDULE_DENIED_MESSAGE[quote.reason] ? quote.reason : 'default')) : (RESCHEDULE_DENIED_MESSAGE[quote.reason] || t('mypage.reschedDenied.default'))); return; }
      reschedModal.open(b, () => load());
    });
  });
  root.querySelectorAll('.btn-review').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      reviewModal.open(b, reviewsByBooking[b.id] || null, () => load());
    });
  });
  root.querySelectorAll('.btn-guarantee-apply').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm(t('mypage.gu.applyConfirm'))) return;
      try {
        await applyGuaranteeClaim(el.dataset.bookingId, addDaysIso(el.dataset.date, 30));
        load();
      } catch (err) {
        alert(t('mypage.gu.applyFailed'));
        console.error(err);
      }
    });
  });
  root.querySelectorAll('.btn-reshoot').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      reschedModal.open(b, () => load(), { reshootClaimId: el.dataset.claimId });
    });
  });
  root.querySelectorAll('.btn-guarantee-claim').forEach((el) => {
    el.addEventListener('click', async () => {
      const note = prompt(t('mypage.gu.claimPrompt'));
      if (note === null) return;
      try {
        await submitGuaranteeClaim(el.dataset.claimId, note || '');
        load();
      } catch (err) {
        alert(t('mypage.gu.claimFailed'));
        console.error(err);
      }
    });
  });
}

let reviewsByBooking = {};

async function load() {
  const session = await getSession();
  if (!session) { location.href = 'login.html?next=' + encodeURIComponent(location.href); return; }

  let [profile, bookings] = await Promise.all([getProfile(), getMyBookings()]);
  reshootsById = Object.fromEntries(bookings.filter((x) => x.reshoot_of).map((x) => [x.id, x]));
  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-mypage').style.display = 'block';
  document.getElementById('pm-user-line').textContent = tf('mypage.userLine', { name: profile?.name || t('mypage.guestName'), email: profile?.email || session.user.email });

  const today = todayIso();
  // An unpaid checkout that timed out is not a booking; don't list it.
  const holdMs = PENDING_PAYMENT_HOLD_MIN * 60 * 1000;
  bookings = bookings.filter((b) => !(b.status === 'pending_payment' && Date.now() - new Date(b.created_at).getTime() > holdMs));
  const upcoming = bookings.filter((b) => b.booking_date >= today);
  const history = bookings.filter((b) => b.booking_date < today);
  const ids = bookings.map((b) => b.id);

  const [counts, reads, sheets, claims, reviews] = await Promise.all([
    getMessageCounts(ids), getReadTimestamps(ids), getCounselingSheetsForBookings(ids), getGuaranteeClaimsForBookings(ids),
    getMyReviewsByBooking(ids),
  ]);
  reviewsByBooking = reviews;

  function metaFor(id) {
    const msgs = counts[id] || [];
    const lastRead = (reads[id] && reads[id].client) || '1970-01-01T00:00:00Z';
    const unread = msgs.filter((m) => m.sender_role === 'pro' && m.created_at > lastRead).length;
    const sheetDone = !!(sheets[id] && sheets[id].submitted_at);
    return { hasUnread: unread > 0, unreadLabel: unread > 9 ? '9+' : String(unread), sheetDone, guarantee: claims[id] || null, review: reviews[id] || null };
  }

  const bookingsById = {};
  bookings.forEach((b) => { bookingsById[b.id] = b; });

  const upcomingEl = document.getElementById('pm-upcoming');
  upcomingEl.innerHTML = upcoming.length
    ? upcoming.map((b) => bookingCardHtml(b, metaFor(b.id), { history: false })).join('')
    : `<div class="pm-empty">${t('mypage.emptyUpcoming')}</div>`;
  wireCardEvents(upcomingEl, bookingsById);

  const historyEl = document.getElementById('pm-history');
  historyEl.innerHTML = history.length
    ? history.map((b) => bookingCardHtml(b, metaFor(b.id), { history: true })).join('')
    : `<div class="pm-empty">${t('mypage.emptyHistory')}</div>`;
  wireCardEvents(historyEl, bookingsById);
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.href = 'index.html';
});

load().catch((err) => {
  document.getElementById('pm-loading').textContent = t('mypage.loadFailed');
  console.error(err);
});
