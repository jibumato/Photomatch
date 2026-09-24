import { mountLayout } from '../layout.js';
import { requireRole, signOut, getSession } from '../auth.js';
import {
  getMyPhotographerRow, getClosedShifts, toggleShift, bulkSetShiftsOpen, bulkSetShiftsClosed,
  getPhotographerBookings, getMessageCounts, getReadTimestamps,
} from '../repo.js';
import { mountChatModal } from '../chat.js';
import { SLOT_TIMES, buildBookingDays } from '../data.js';

mountLayout();

const chatModal = mountChatModal(document.getElementById('pm-chat-mount'));

const STATUS_LABEL = { paid: '確定', confirmed: '確定', requested: '依頼中', completed: '完了', canceled: 'キャンセル済' };
const STATUS_STYLE = {
  '確定': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '依頼中': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '完了': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  'キャンセル済': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
};

function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

const state = {
  photographerId: null,
  days: buildBookingDays(7),
  takenIntervals: {}, // iso -> [[startMin,endMin], ...]
  closedSet: new Set(), // `${iso}|${time}`
  bookings: [],
};

async function loadShifts() {
  const fromIso = state.days[0].iso;
  const toIso = state.days[state.days.length - 1].iso;
  const closed = await getClosedShifts(state.photographerId, fromIso, toIso);
  state.closedSet = new Set(closed.filter((r) => !r.is_open).map((r) => `${r.shift_date}|${r.start_time.slice(0, 5)}`));
}

function computeTakenIntervals() {
  state.takenIntervals = {};
  state.bookings.filter((b) => b.status !== 'canceled').forEach((b) => {
    const key = b.booking_date;
    state.takenIntervals[key] = state.takenIntervals[key] || [];
    state.takenIntervals[key].push([timeToMinutes(b.start_time), timeToMinutes(b.end_time)]);
  });
}

function cellState(iso, time) {
  const mins = timeToMinutes(time);
  const intervals = state.takenIntervals[iso] || [];
  if (intervals.some(([s, e]) => mins >= s && mins < e)) return 'booked';
  if (state.closedSet.has(`${iso}|${time}`)) return 'closed';
  return 'open';
}

function renderGrid() {
  const grid = document.getElementById('shift-grid');
  grid.style.gridTemplateColumns = `48px repeat(${state.days.length}, minmax(44px,1fr))`;
  grid.style.minWidth = (48 + state.days.length * 46) + 'px';

  let html = '<div></div>';
  state.days.forEach((d) => {
    html += `<div class="pm-cal-daylabel" style="color:${d.labelColor}">${d.label}<br><span style="font:400 11px var(--pm-font-num);color:var(--pm-text-3)">${d.dateLabel}</span></div>`;
  });

  let openCount = 0;
  SLOT_TIMES.forEach((time) => {
    html += `<div class="pm-cal-time">${time}</div>`;
    state.days.forEach((d) => {
      const st = cellState(d.iso, time);
      if (st === 'open') openCount++;
      let bg, color, extraStyle, mark, cursor;
      if (st === 'booked') {
        bg = 'oklch(0.9 0.02 260)'; color = 'oklch(0.4 0.06 260)'; mark = '予約'; cursor = 'not-allowed'; extraStyle = '';
      } else if (st === 'closed') {
        bg = 'oklch(0.96 0.006 220)'; color = 'oklch(0.55 0.02 220)'; mark = '休'; cursor = 'pointer'; extraStyle = 'border:1px dashed oklch(0.85 0.02 220);';
      } else {
        bg = 'var(--pm-accent-grad)'; color = '#fff'; mark = '○'; cursor = 'pointer'; extraStyle = '';
      }
      html += `<div class="pm-cal-cell" data-day="${d.iso}" data-time="${time}" data-state="${st}" style="background:${bg};color:${color};${extraStyle}cursor:${cursor};font-weight:${st === 'open' ? 700 : 600}">${mark}</div>`;
    });
  });
  grid.innerHTML = html;
  document.getElementById('open-count-line').textContent = `受付中の枠：${openCount}`;

  grid.querySelectorAll('.pm-cal-cell[data-state]').forEach((el) => {
    if (el.dataset.state === 'booked') return;
    el.addEventListener('click', async () => {
      const iso = el.dataset.day;
      const time = el.dataset.time;
      const closeIt = el.dataset.state === 'open';
      try {
        await toggleShift(state.photographerId, iso, time, closeIt);
        await loadShifts();
        renderGrid();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
      }
    });
  });
}

document.getElementById('btn-all-open').addEventListener('click', async () => {
  const btn = document.getElementById('btn-all-open');
  btn.disabled = true;
  try {
    await bulkSetShiftsOpen(state.photographerId, state.days.map((d) => d.iso));
    await loadShifts();
    renderGrid();
  } catch (err) {
    alert('更新に失敗しました。');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btn-all-closed').addEventListener('click', async () => {
  if (!confirm('表示中の7日間の空き枠をすべて休みに設定します。よろしいですか？')) return;
  const btn = document.getElementById('btn-all-closed');
  btn.disabled = true;
  try {
    const rows = [];
    state.days.forEach((d) => {
      SLOT_TIMES.forEach((time) => {
        if (cellState(d.iso, time) !== 'booked') rows.push({ shift_date: d.iso, start_time: time });
      });
    });
    await bulkSetShiftsClosed(state.photographerId, rows);
    await loadShifts();
    renderGrid();
  } catch (err) {
    alert('更新に失敗しました。');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

function bookingCardHtml(b, meta) {
  const statusLabel = STATUS_LABEL[b.status] || b.status;
  return `
  <div class="pm-card" style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div style="min-width:0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${b.customer_name || '依頼者'}</span>
        <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${STATUS_STYLE[statusLabel] || ''}">${statusLabel}</span>
      </div>
      <div style="font:13px var(--pm-font-body);color:oklch(0.45 0.02 235)">${b.booking_date}（${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}）</div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${b.plan_name}</div>
    </div>
    <button data-booking-id="${b.id}" class="btn-chat" style="position:relative;display:flex;align-items:center;gap:6px;background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer;white-space:nowrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"></path></svg>
      メッセージ
      ${meta.hasUnread ? `<span class="pm-unread-badge">${meta.unreadLabel}</span>` : ''}
    </button>
  </div>`;
}

async function renderBookings() {
  const el = document.getElementById('pm-bookings');
  if (!state.bookings.length) {
    el.innerHTML = '<div class="pm-empty">予約はまだありません。</div>';
    return;
  }
  const ids = state.bookings.map((b) => b.id);
  const [counts, reads] = await Promise.all([getMessageCounts(ids), getReadTimestamps(ids)]);

  function metaFor(id) {
    const msgs = counts[id] || [];
    const lastRead = (reads[id] && reads[id].pro) || '1970-01-01T00:00:00Z';
    const unread = msgs.filter((m) => m.sender_role === 'client' && m.created_at > lastRead).length;
    return { hasUnread: unread > 0, unreadLabel: unread > 9 ? '9+' : String(unread) };
  }

  el.innerHTML = state.bookings.map((b) => bookingCardHtml(b, metaFor(b.id))).join('');
  el.querySelectorAll('.btn-chat').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = state.bookings.find((x) => x.id === btn.dataset.bookingId);
      chatModal.open(b.id, 'pro', b.customer_name || '依頼者', `${b.booking_date} ${b.start_time.slice(0, 5)}〜`);
    });
  });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.href = 'index.html';
});

// ---------- Stripe受け取り設定 ----------
async function renderStripeSection(photographer) {
  const el = document.getElementById('pm-stripe-section');
  const params = new URLSearchParams(location.search);

  if (params.get('stripe_return')) {
    el.innerHTML = '<div style="font:13px var(--pm-font-body);color:var(--pm-text-3)">Stripeの設定状況を確認しています…</div>';
    try {
      const session = await getSession();
      const res = await fetch('/api/connect/status', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (res.ok) {
        photographer.stripe_payouts_enabled = data.payouts_enabled;
        photographer.stripe_charges_enabled = data.charges_enabled;
      }
    } catch (err) { /* fall back to the last-known DB value rendered below */ }
    history.replaceState(null, '', location.pathname);
  }

  if (photographer.stripe_payouts_enabled) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font:700 12px var(--pm-font-body);color:#fff;background:oklch(0.55 0.14 160);border-radius:100px;padding:4px 12px">設定済み</span>
        <span style="font:13px var(--pm-font-body);color:var(--pm-text-3)">Stripeでの報酬受け取り設定が完了しています。</span>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">Stripeで報酬の受け取り設定を行う</div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 14px">お客様からのお支払いは一旦PhotoMatchでお預かりし、撮影完了・保証期間（30日）経過後にStripe経由で報酬（プラン料金の50%）をお振込みします。受け取るにはStripeでの口座・本人確認登録が必要です。</p>
    <button class="pm-btn pm-btn-primary" id="stripe-onboard-btn">Stripeで設定する</button>
    <div class="pm-error-text" id="stripe-onboard-error" style="display:none;margin-top:10px"></div>`;

  document.getElementById('stripe-onboard-btn').addEventListener('click', async () => {
    const btn = document.getElementById('stripe-onboard-btn');
    const errorEl = document.getElementById('stripe-onboard-error');
    errorEl.style.display = 'none';
    btn.disabled = true;
    try {
      const session = await getSession();
      const res = await fetch('/api/connect/onboard', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '設定の開始に失敗しました。');
      location.href = data.url;
    } catch (err) {
      errorEl.textContent = err.message || '設定の開始に失敗しました。時間をおいて再度お試しください。';
      errorEl.style.display = 'block';
      btn.disabled = false;
    }
  });
}

async function init() {
  const profile = await requireRole('photographer', 'pro-login.html');
  if (!profile) return;

  const photographer = await getMyPhotographerRow();
  document.getElementById('pm-loading').style.display = 'none';

  if (!photographer) {
    const emptyEl = document.getElementById('pm-empty-state');
    emptyEl.style.display = 'block';
    emptyEl.textContent = 'カメラマンプロフィールがまだ設定されていません。運営にお問い合わせください。';
    return;
  }

  state.photographerId = photographer.id;
  document.getElementById('pm-admin').style.display = 'block';
  renderStripeSection(photographer);

  const [bookings] = await Promise.all([getPhotographerBookings(state.photographerId), loadShifts()]);
  state.bookings = bookings;
  computeTakenIntervals();
  renderGrid();
  await renderBookings();
}

init().catch((err) => {
  document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
  console.error(err);
});
