import { mountLayout } from '../layout.js';
import { getSession, getProfile, signOut } from '../auth.js';
import {
  getMyBookings, cancelBooking, getMessageCounts, getReadTimestamps, getCounselingSheetsForBookings,
} from '../repo.js';
import { mountChatModal } from '../chat.js';
import { mountSheetModal } from '../sheet.js';

mountLayout();

const chatModal = mountChatModal(document.getElementById('pm-chat-mount'));
const sheetModal = mountSheetModal(document.getElementById('pm-sheet-mount'));

const STATUS_LABEL = { paid: '確定', confirmed: '確定', requested: '依頼中', completed: '完了', canceled: 'キャンセル済' };
const STATUS_STYLE = {
  '確定': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '依頼中': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '完了': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  'キャンセル済': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
};

function todayIso() { return new Date().toISOString().slice(0, 10); }

function bookingCardHtml(b, meta, { history }) {
  const statusLabel = STATUS_LABEL[b.status] || b.status;
  const cancellable = !history && b.status !== 'canceled' && b.status !== 'completed';
  const priceLabel = `¥${b.total_price.toLocaleString()}（税込）`;
  return `
  <div class="pm-card" style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;${history ? 'background:var(--pm-bg)' : ''}">
    <div style="min-width:0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${b.photographer_name}</span>
        <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${STATUS_STYLE[statusLabel] || ''}">${statusLabel}</span>
      </div>
      <div style="font:13px var(--pm-font-body);color:oklch(0.45 0.02 235)">${b.booking_date}（${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}）</div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${b.plan_name} ・ ${priceLabel}</div>
    </div>
    ${history ? '' : `
    <div style="display:flex;gap:8px;align-items:center">
      <button data-booking-id="${b.id}" class="btn-chat" style="position:relative;display:flex;align-items:center;gap:6px;background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:#fff;cursor:pointer;white-space:nowrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"></path></svg>
        メッセージ
        ${meta.hasUnread ? `<span class="pm-unread-badge">${meta.unreadLabel}</span>` : ''}
      </button>
      <button data-booking-id="${b.id}" class="btn-sheet" style="display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid oklch(0.86 0.03 215);border-radius:100px;padding:9px 16px;font:700 12px var(--pm-font-body);color:oklch(0.4 0.06 235);cursor:pointer;white-space:nowrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        ${meta.sheetDone ? 'カウンセリング済' : '事前カウンセリング'}
        ${meta.sheetDone ? '<span style="color:oklch(0.6 0.14 150);font:700 13px var(--pm-font-num)">✓</span>' : ''}
      </button>
      ${cancellable ? `<button data-booking-id="${b.id}" class="btn-cancel pm-btn-danger-outline">キャンセル</button>` : ''}
    </div>`}
  </div>`;
}

function wireCardEvents(root, bookingsById) {
  root.querySelectorAll('.btn-chat').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      chatModal.open(b.id, 'client', b.photographer_name, `${b.booking_date} ${b.start_time.slice(0, 5)}〜`);
    });
  });
  root.querySelectorAll('.btn-sheet').forEach((el) => {
    el.addEventListener('click', () => {
      const b = bookingsById[el.dataset.bookingId];
      sheetModal.open(b.id, `${b.booking_date} ${b.start_time.slice(0, 5)}〜 ・ ${b.photographer_name}さん`);
    });
  });
  root.querySelectorAll('.btn-cancel').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('一度キャンセルすると、返金はできません。\n本当にキャンセルしますか？')) return;
      try {
        await cancelBooking(el.dataset.bookingId);
        load();
      } catch (err) {
        alert('キャンセル処理に失敗しました。');
        console.error(err);
      }
    });
  });
}

async function load() {
  const session = await getSession();
  if (!session) { location.href = 'login.html?next=' + encodeURIComponent(location.href); return; }

  const [profile, bookings] = await Promise.all([getProfile(), getMyBookings()]);
  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-mypage').style.display = 'block';
  document.getElementById('pm-user-line').textContent = `${profile?.name || 'ゲスト ユーザー'}　（${profile?.email || session.user.email}）`;

  const today = todayIso();
  const upcoming = bookings.filter((b) => b.booking_date >= today);
  const history = bookings.filter((b) => b.booking_date < today);
  const ids = bookings.map((b) => b.id);

  const [counts, reads, sheets] = await Promise.all([
    getMessageCounts(ids), getReadTimestamps(ids), getCounselingSheetsForBookings(ids),
  ]);

  function metaFor(id) {
    const msgs = counts[id] || [];
    const lastRead = (reads[id] && reads[id].client) || '1970-01-01T00:00:00Z';
    const unread = msgs.filter((m) => m.sender_role === 'pro' && m.created_at > lastRead).length;
    const sheetDone = !!(sheets[id] && sheets[id].submitted_at);
    return { hasUnread: unread > 0, unreadLabel: unread > 9 ? '9+' : String(unread), sheetDone };
  }

  const bookingsById = {};
  bookings.forEach((b) => { bookingsById[b.id] = b; });

  const upcomingEl = document.getElementById('pm-upcoming');
  upcomingEl.innerHTML = upcoming.length
    ? upcoming.map((b) => bookingCardHtml(b, metaFor(b.id), { history: false })).join('')
    : '<div class="pm-empty">今後のご予約はありません。</div>';
  wireCardEvents(upcomingEl, bookingsById);

  const historyEl = document.getElementById('pm-history');
  historyEl.innerHTML = history.length
    ? history.map((b) => bookingCardHtml(b, metaFor(b.id), { history: true })).join('')
    : '<div class="pm-empty">撮影履歴はまだありません。</div>';
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.href = 'index.html';
});

load().catch((err) => {
  document.getElementById('pm-loading').textContent = '予約情報の取得に失敗しました。';
  console.error(err);
});
