import { mountLayout } from '../layout.js';
import { requireRole, signOut } from '../auth.js';
import {
  getMyPhotographerRow, getOpenShifts, openShifts, closeShifts,
  getPhotographerBookings, getMessageCounts, getReadTimestamps,
  getBankAccount, saveBankAccount, getCounselingSheetsForBookings, deliverBooking, ackBooking, lineLink,
} from '../repo.js';
import { mountChatModal } from '../chat.js';
import { loadDailyWeather } from '../weather.js';
import { mountProfileEditor } from '../profileEditor.js';
import {
  AREAS, SLOT_TIMES, TOTAL_BOOKING_DAYS, WEEKDAY_JP, PENDING_PAYMENT_HOLD_MIN, buildBookingDays, weatherIconFor,
  EXTRA_OPTIONS, COUNSELING_QUESTIONS, meetingPointForArea, deliveryDueDate, photographerPayoutFor, isValidDeliveryUrl, jstDateIso,
  awaitingPhotographerAck, PHOTOGRAPHER_ACK_HOURS,
} from '../data.js';
import { takenIntervalsFrom, openSetFrom, cellState as slotState } from '../availability.js';
import { escapeHtml } from '../util.js';

mountLayout();

const chatModal = mountChatModal(document.getElementById('pm-chat-mount'), { onClose: () => renderBookings().catch(console.error) });

const STATUS_LABEL = { paid: '確定', confirmed: '確定', requested: '依頼中', completed: '完了', canceled: 'キャンセル済' };
const STATUS_STYLE = {
  '確定': 'background:oklch(0.94 0.06 200);color:oklch(0.4 0.14 200)',
  '依頼中': 'background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75)',
  '完了': 'background:oklch(0.93 0.01 220);color:oklch(0.45 0.02 235)',
  'キャンセル済': 'background:oklch(0.93 0.008 220);color:oklch(0.55 0.02 220)',
};

const state = {
  photographerId: null,
  days: buildBookingDays(TOTAL_BOOKING_DAYS), // the same 30 days customers can book
  takenIntervals: {}, // iso -> [[startMin,endMin], ...]
  openSet: new Set(), // `${iso}|${time}` slots the photographer has opened (closed by default)
  bookings: [],
  area: AREAS[0],
  weather: null, // per-day { code, pop } aligned with `days`, or null if unavailable
};

// The forecast follows the photographer's own area (falling back to Nagoya
// while it's still 未設定), since the grid has no per-booking area.
async function loadWeather() {
  state.weather = await loadDailyWeather(state.area, state.days);
  document.getElementById('shift-weather-line').textContent = state.weather
    ? `天気予報は「${state.area.label}」の予報です。`
    : '天気予報を取得できませんでした。';
}

async function loadShifts() {
  const fromIso = state.days[0].iso;
  const toIso = state.days[state.days.length - 1].iso;
  state.openSet = openSetFrom(await getOpenShifts(state.photographerId, fromIso, toIso));
}

// Bookings that hold a slot: not canceled, and not an unpaid checkout that has
// already timed out (those slots are given back to customers, so the grid
// must show them as free too).
function computeTakenIntervals() {
  const holdMs = PENDING_PAYMENT_HOLD_MIN * 60 * 1000;
  state.takenIntervals = takenIntervalsFrom(state.bookings.filter((b) => {
    if (b.status === 'canceled') return false;
    if (b.status === 'pending_payment' && Date.now() - new Date(b.created_at).getTime() > holdMs) return false;
    return true;
  }));
}

function cellState(iso, time) {
  return slotState(state.takenIntervals, state.openSet, iso, time);
}

function renderGrid() {
  const grid = document.getElementById('shift-grid');
  grid.style.gridTemplateColumns = `48px repeat(${state.days.length}, minmax(44px,1fr))`;
  grid.style.minWidth = (48 + state.days.length * 46) + 'px';

  let html = '<div></div>';
  state.days.forEach((d, i) => {
    const w = state.weather && state.weather[i];
    const wi = weatherIconFor(w ? w.code : null);
    const pop = w && w.pop != null ? w.pop + '%' : '';
    html += `<div class="pm-cal-daylabel" style="color:${d.labelColor}">${d.label}<br><span style="font:400 11px var(--pm-font-num);color:var(--pm-text-3)">${d.dateLabel}</span><br><span style="font:700 17px var(--pm-font-body);color:${wi.color}">${wi.icon}</span> <span style="font:600 11px var(--pm-font-body);color:var(--pm-text-3)">${pop}</span></div>`;
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
      const row = [{ shift_date: iso, start_time: time }];
      try {
        if (el.dataset.state === 'open') await closeShifts(state.photographerId, row);
        else await openShifts(state.photographerId, row);
        await loadShifts();
        renderGrid();
      } catch (err) {
        alert('更新に失敗しました。');
        console.error(err);
      }
    });
  });
}

// ---- 「まとめて設定する」: time range × weekdays over the 30 displayed days ----
const tplFrom = document.getElementById('tpl-from');
const tplTo = document.getElementById('tpl-to');
tplFrom.innerHTML = SLOT_TIMES.map((t) => `<option value="${t}">${t}</option>`).join('');
tplTo.innerHTML = SLOT_TIMES.concat(['22:00']).map((t) => `<option value="${t}">${t}</option>`).join('');
tplFrom.value = '10:00';
tplTo.value = '18:00';
// Monday first reads more naturally than Sunday first for a work schedule.
const TPL_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
document.getElementById('tpl-days').innerHTML = TPL_DAY_ORDER.map((dow) => `
  <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="tpl-day" value="${dow}" ${dow === 0 || dow === 6 ? 'checked' : ''}>${WEEKDAY_JP[dow]}</label>`).join('');

// Slots (not already booked) matching the chosen time range and weekdays.
function templateRows() {
  const days = new Set([...document.querySelectorAll('.tpl-day:checked')].map((el) => Number(el.value)));
  const from = tplFrom.value;
  const to = tplTo.value;
  const rows = [];
  state.days.forEach((d) => {
    if (!days.has(d.date.getDay())) return;
    SLOT_TIMES.forEach((time) => {
      if (time >= from && time < to && cellState(d.iso, time) !== 'booked') rows.push({ shift_date: d.iso, start_time: time });
    });
  });
  return rows;
}

async function applyTemplate(btn, apply, emptyMessage) {
  if (tplFrom.value >= tplTo.value) { alert('終了時刻は開始時刻より後にしてください。'); return; }
  const rows = templateRows();
  if (!rows.length) { alert(emptyMessage); return; }
  btn.disabled = true;
  try {
    await apply(state.photographerId, rows);
    await loadShifts();
    renderGrid();
  } catch (err) {
    alert('更新に失敗しました。');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('btn-tpl-open').addEventListener('click', (e) => applyTemplate(e.currentTarget, openShifts, '曜日を1つ以上選んでください。'));
document.getElementById('btn-tpl-close').addEventListener('click', (e) => applyTemplate(e.currentTarget, closeShifts, '曜日を1つ以上選んでください。'));

document.getElementById('btn-all-closed').addEventListener('click', async () => {
  if (!confirm('表示中の30日間の受付中の枠を、すべて休みに設定します。よろしいですか？')) return;
  const btn = document.getElementById('btn-all-closed');
  btn.disabled = true;
  try {
    const rows = [];
    state.days.forEach((d) => {
      SLOT_TIMES.forEach((time) => {
        if (cellState(d.iso, time) === 'open') rows.push({ shift_date: d.iso, start_time: time });
      });
    });
    await closeShifts(state.photographerId, rows);
    await loadShifts();
    renderGrid();
  } catch (err) {
    alert('更新に失敗しました。');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

const CANCEL_REASON_TEXT = { customer: 'お客様がキャンセル', no_show: '遅刻（15分以上）のため当日キャンセル扱い', system: '決済の取り消し', ops: '運営がキャンセル' };
const yen = (n) => `¥${Number(n || 0).toLocaleString()}`;
const fmtDate = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const shootStarted = (b) => new Date(`${b.booking_date}T${b.start_time.slice(0, 5)}:00+09:00`) <= new Date();

// What the photographer sees for one booking: everything needed for the day
// (time, place, plan, options, contact), the counseling answers, delivery.
function displayStatus(b) {
  if (b.status === 'canceled') return 'キャンセル済';
  if (b.delivered_at) return '納品済み';
  if (shootStarted(b)) return '撮影済み（未納品）';
  return STATUS_LABEL[b.status] || b.status;
}

function bookingCardHtml(b, meta) {
  const statusLabel = displayStatus(b);
  const canceled = b.status === 'canceled';
  const options = (b.options || []).map((o) => EXTRA_OPTIONS.find((x) => x.key === o.key)).filter(Boolean);
  const mp = meetingPointForArea(b.area);
  const due = deliveryDueDate(b);
  const overdue = !canceled && !b.delivered_at && jstDateIso() > due.date;
  const lines = [
    `${b.booking_date}（${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}）${b.order_number ? `<span style="font:11px var(--pm-font-num);color:var(--pm-text-muted);margin-left:8px">注文番号 ${escapeHtml(b.order_number)}</span>` : ''}`,
    `${escapeHtml(b.plan_name || '')}${b.monitor_application_id ? '（モニター価格）' : ''}${options.length ? `　オプション：${options.map((o) => escapeHtml(o.label)).join('、')}` : '　オプションなし'}`,
    `${escapeHtml(b.area || '')}${mp ? `　集合：${escapeHtml(mp.detail)}` : ''}`,
    `連絡先：${escapeHtml(b.customer_contact || '-')}`,
  ];
  if (b.rescheduled_count) lines.push(`日程変更あり（変更前：${b.previous_booking_date} ${String(b.previous_start_time || '').slice(0, 5)}〜）`);
  if (canceled) {
    lines.push(`${CANCEL_REASON_TEXT[b.cancel_reason] || 'キャンセル'}${b.photographer_cancel_comp ? `　補償 ${yen(b.photographer_cancel_comp)}` : ''}`);
  } else {
    lines.push(b.delivered_at
      ? `納品済み（${b.delivered_at.slice(0, 10)}）`
      : `<span style="${overdue ? 'color:var(--pm-warn-text);font-weight:700' : ''}">納品期限：${fmtDate(due.date)}${due.speed ? '（スピード納品）' : ''}${overdue ? '　期限を過ぎています' : ''}</span>`);
  }
  const payout = photographerPayoutFor(b);
  if (payout) lines.push(`報酬：${yen(payout)}　${b.payout_status === 'released' ? '送金済み' : '未送金'}`);
  const awaitingAck = awaitingPhotographerAck(b);
  if (awaitingAck) lines.push(`<b style="color:var(--pm-warn-text)">未確認：内容を確認したら「確認しました」を押してください（${PHOTOGRAPHER_ACK_HOURS}時間以内に確認がない場合、運営からご連絡します）</b>`);
  else if (b.photographer_ack_at && !canceled) lines.push(`確認済み（${new Date(b.photographer_ack_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）`);

  const btn = 'display:flex;align-items:center;gap:6px;border-radius:100px;padding:9px 14px;font:700 12px var(--pm-font-body);cursor:pointer;white-space:nowrap';
  const actions = [];
  if (awaitingAck) actions.push(`<button data-booking-id="${b.id}" class="btn-ack" style="${btn};background:var(--pm-brand-grad);border:none;color:#fff">確認しました</button>`);
  actions.push(`<button data-booking-id="${b.id}" class="btn-chat" style="position:relative;${btn};background:var(--pm-brand-grad-soft);border:none;color:#fff">
      メッセージ${meta.hasUnread ? `<span class="pm-unread-badge">${meta.unreadLabel}</span>` : ''}
    </button>`);
  if (!canceled) {
    actions.push(`<button data-booking-id="${b.id}" class="btn-sheet-view" style="${btn};background:#fff;border:1.5px solid oklch(0.86 0.03 215);color:oklch(0.4 0.06 235)">カウンセリング${meta.sheetDone ? '（回答あり）' : '（未回答）'}</button>`);
    if (shootStarted(b)) actions.push(`<button data-booking-id="${b.id}" class="btn-deliver" style="${btn};background:#fff;border:1.5px solid oklch(0.62 0.14 210);color:oklch(0.4 0.12 215)">${b.delivered_at ? '納品リンクを変更' : '納品する'}</button>`);
  }
  return `
  <div class="pm-card" style="padding:18px 20px;${canceled ? 'background:var(--pm-bg)' : ''}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
      <span style="font:700 15px var(--pm-font-body)">${escapeHtml(b.customer_name || '依頼者')}</span>
      ${awaitingAck ? '<span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;background:oklch(0.95 0.06 70);color:oklch(0.45 0.13 55)">未確認</span>' : ''}
      <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${STATUS_STYLE[statusLabel] || 'background:oklch(0.94 0.04 210);color:oklch(0.4 0.1 220)'}">${escapeHtml(statusLabel)}</span>
    </div>
    <div style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3)">${lines.map((l, i) => `<div style="${i === 0 ? 'font:13px var(--pm-font-body);color:oklch(0.35 0.02 235)' : ''}">${l}</div>`).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${actions.join('')}</div>
  </div>`;
}

// Upcoming first (soonest first), then past shoots (newest first). Unpaid
// checkouts aren't bookings yet, so they're not listed.
function sortedBookings() {
  const list = state.bookings.filter((b) => b.status !== 'pending_payment');
  const today = jstDateIso();
  const upcoming = list.filter((b) => b.booking_date >= today && b.status !== 'canceled');
  const rest = list.filter((b) => !upcoming.includes(b)).sort((a, b) => (a.booking_date < b.booking_date ? 1 : -1));
  return [...upcoming, ...rest];
}

let sheetsByBooking = {};

async function renderBookings() {
  const el = document.getElementById('pm-bookings');
  const list = sortedBookings();
  renderEarnings();
  if (!list.length) {
    el.innerHTML = '<div class="pm-empty">予約はまだありません。</div>';
    return;
  }
  const ids = list.map((b) => b.id);
  const [counts, reads, sheets] = await Promise.all([getMessageCounts(ids), getReadTimestamps(ids), getCounselingSheetsForBookings(ids)]);
  sheetsByBooking = sheets;

  function metaFor(id) {
    const msgs = counts[id] || [];
    const lastRead = (reads[id] && reads[id].pro) || '1970-01-01T00:00:00Z';
    const unread = msgs.filter((m) => m.sender_role === 'client' && m.created_at > lastRead).length;
    const sheet = sheets[id];
    return { hasUnread: unread > 0, unreadLabel: unread > 9 ? '9+' : String(unread), sheetDone: !!(sheet && sheet.submitted_at) };
  }

  el.innerHTML = list.map((b) => bookingCardHtml(b, metaFor(b.id))).join('');
  const find = (btn) => state.bookings.find((x) => x.id === btn.dataset.bookingId);
  el.querySelectorAll('.btn-chat').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = find(btn);
      chatModal.open(b.id, 'pro', b.customer_name || '依頼者', `${b.booking_date} ${b.start_time.slice(0, 5)}〜`);
    });
  });
  el.querySelectorAll('.btn-ack').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await ackBooking(btn.dataset.bookingId);
      state.bookings = await getPhotographerBookings(state.photographerId);
      await renderBookings();
    } catch (err) {
      alert(err.message || '確認の登録に失敗しました。');
      btn.disabled = false;
    }
  }));
  el.querySelectorAll('.btn-sheet-view').forEach((btn) => btn.addEventListener('click', () => openSheetView(find(btn))));
  el.querySelectorAll('.btn-deliver').forEach((btn) => btn.addEventListener('click', async () => {
    const b = find(btn);
    const url = prompt(`${b.customer_name || '依頼者'} 様（${b.booking_date}）の撮影データのリンク（Googleフォトのアルバムなど、https:// から始まるURL）を入力してください。\nお客様にメールで届き、マイページにも表示されます。`, b.delivery_url || '');
    if (url === null) return;
    if (!isValidDeliveryUrl(url.trim())) { alert('「https://」から始まるURLを入力してください。'); return; }
    btn.disabled = true;
    try {
      await deliverBooking(b.id, url.trim());
      alert(b.delivered_at ? '納品リンクを更新しました。お客様にメールでお知らせしました。' : '納品済みにしました。お客様にリンクをメールでお送りしました。');
      state.bookings = await getPhotographerBookings(state.photographerId);
      await renderBookings();
    } catch (err) {
      alert(err.message || '納品の登録に失敗しました。');
      btn.disabled = false;
    }
  }));
}

// ---- 事前カウンセリングの回答（読み取り専用） ----
const sheetMount = document.getElementById('pm-sheetview-mount');
sheetMount.innerHTML = `
  <div class="pm-modal-overlay" id="sv-overlay">
    <div class="pm-modal-backdrop" id="sv-backdrop"></div>
    <div class="pm-modal-sheet pm-sheet-modal" style="height:auto;max-height:92vh" role="dialog" aria-modal="true" aria-labelledby="sv-title">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="sv-title" style="font:700 16px var(--pm-font-body);color:oklch(0.24 0.02 245)">事前カウンセリングの回答</div>
          <div id="sv-label" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="sv-close" aria-label="閉じる">×</button>
      </div>
      <div class="pm-sheet-body" id="sv-body"></div>
    </div>
  </div>`;
const svOverlay = document.getElementById('sv-overlay');
const closeSheetView = () => svOverlay.classList.remove('is-open');
document.getElementById('sv-close').addEventListener('click', closeSheetView);
document.getElementById('sv-backdrop').addEventListener('click', closeSheetView);

function openSheetView(b) {
  const sheet = sheetsByBooking[b.id];
  const answers = (sheet && sheet.answers) || {};
  document.getElementById('sv-label').textContent = `${b.customer_name || '依頼者'} 様 ・ ${b.booking_date} ${b.start_time.slice(0, 5)}〜`;
  const answered = COUNSELING_QUESTIONS.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length : v && String(v).trim();
  });
  document.getElementById('sv-body').innerHTML = answered.length
    ? answered.map((q) => {
      const v = answers[q.id];
      return `<div style="margin-bottom:16px"><div style="font:700 12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:4px">${escapeHtml(q.label)}</div>
        <div style="font:14px/1.7 var(--pm-font-body);color:oklch(0.3 0.02 235);white-space:pre-wrap">${escapeHtml(Array.isArray(v) ? v.join('、') : v)}</div></div>`;
    }).join('')
    : '<div class="pm-empty">まだ回答がありません。お客様が回答すると、ここに表示されます。</div>';
  svOverlay.classList.add('is-open');
}

// ---- 報酬（撮影月ごと） ----
function renderEarnings() {
  const el = document.getElementById('pm-earnings');
  const rows = state.bookings.filter((b) => photographerPayoutFor(b) > 0 && b.status !== 'pending_payment' && (b.status === 'canceled' || shootStarted(b)));
  if (!rows.length) { el.innerHTML = '<div class="pm-empty">まだ報酬の対象になる撮影はありません。</div>'; return; }
  const months = {};
  rows.forEach((b) => {
    const m = b.booking_date.slice(0, 7);
    const g = (months[m] = months[m] || { total: 0, released: 0, count: 0, undelivered: 0 });
    const amount = photographerPayoutFor(b);
    g.total += amount; g.count += 1;
    if (b.payout_status === 'released') g.released += amount;
    if (b.status !== 'canceled' && !b.delivered_at) g.undelivered += 1;
  });
  el.innerHTML = `<div class="pm-card" style="padding:6px 0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font:13px var(--pm-font-body)">
    <thead><tr style="color:var(--pm-text-3);font-size:12px;text-align:left"><th style="padding:10px 16px">撮影月</th><th>件数</th><th>報酬の見込み</th><th>送金済み</th><th style="padding-right:16px">未納品</th></tr></thead>
    <tbody>${Object.keys(months).sort().reverse().map((m) => {
      const g = months[m];
      return `<tr style="border-top:1px solid var(--pm-border-faint)"><td style="padding:10px 16px">${m.replace('-', '年')}月</td><td>${g.count}件</td><td>${yen(g.total)}</td><td>${yen(g.released)}</td><td style="padding-right:16px;${g.undelivered ? 'color:var(--pm-warn-text);font-weight:700' : ''}">${g.undelivered}件</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.href = 'index.html';
});

// ---------- 報酬振込先の登録 ----------
function bankAccountFormHtml(account) {
  const a = account || {};
  return `
    <div style="font:700 15px var(--pm-font-body);margin-bottom:6px">報酬の振込先を登録する</div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 14px">お客様からのお支払いは一旦PhotoMatchでお預かりし、撮影完了・保証期間（30日）経過後、月末締め・翌月25日払いで運営より銀行振込にてお支払いします。報酬は「プラン料金の50%＋オプション1件につき¥1,100」です。お客様の当日キャンセルの場合は、補償として¥2,000（税込）をお支払いします。</p>
    <div style="display:flex;flex-direction:column;gap:14px;max-width:400px">
      <div class="pm-field">
        <label>金融機関名</label>
        <input class="pm-input" type="text" id="f-bank-name" placeholder="例）〇〇銀行" value="${a.bank_name ? escapeAttr(a.bank_name) : ''}">
      </div>
      <div class="pm-field">
        <label>支店名</label>
        <input class="pm-input" type="text" id="f-branch-name" placeholder="例）〇〇支店" value="${a.branch_name ? escapeAttr(a.branch_name) : ''}">
      </div>
      <div class="pm-field">
        <label>口座種別</label>
        <select class="pm-select" id="f-account-type">
          <option value="ordinary" ${a.account_type !== 'checking' ? 'selected' : ''}>普通</option>
          <option value="checking" ${a.account_type === 'checking' ? 'selected' : ''}>当座</option>
        </select>
      </div>
      <div class="pm-field">
        <label>口座番号</label>
        <input class="pm-input" type="text" inputmode="numeric" id="f-account-number" placeholder="1234567" value="${a.account_number ? escapeAttr(a.account_number) : ''}">
      </div>
      <div class="pm-field">
        <label>口座名義（カタカナ）</label>
        <input class="pm-input" type="text" id="f-account-holder" placeholder="例）ヤマダ タロウ" value="${a.account_holder_name ? escapeAttr(a.account_holder_name) : ''}">
      </div>
      <div class="pm-error-text" id="bank-account-error" style="display:none"></div>
      <button class="pm-btn pm-btn-primary" id="bank-account-save-btn" style="align-self:flex-start">${account ? '更新する' : '登録する'}</button>
      <div id="bank-account-saved-note" style="display:none;font:12px var(--pm-font-body);color:oklch(0.5 0.14 160)">保存しました。</div>
    </div>`;
}

const escapeAttr = escapeHtml;

// ---- LINE通知（予約や依頼者からのメッセージをLINEでも受け取る） ----
// Hidden until LINE is set up on the server (/api/line/link reports it).
let linePoll = null;

async function renderLineSection() {
  const el = document.getElementById('pm-line-section');
  let status;
  try {
    status = await lineLink('status');
  } catch (err) {
    return; // keep the section hidden; email notifications still work
  }
  if (!status.configured) return;
  el.style.display = 'block';
  const title = '<div style="font:700 15px var(--pm-font-body);margin-bottom:6px">LINE通知</div>';
  const note = (t) => `<p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 12px">${t}</p>`;
  if (status.linked) {
    if (linePoll) { clearInterval(linePoll); linePoll = null; }
    el.innerHTML = `${title}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);background:oklch(0.94 0.07 150);color:oklch(0.4 0.12 155)">連携済み</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${escapeHtml(new Date(status.linked_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}</span></div>
      ${note('予約の確定・日程変更・キャンセル、依頼者からのメッセージをLINEでもお知らせします（メールも引き続き届きます）。予約の通知の「確認しました」ボタンは、LINEからも押せます。')}
      ${status.last_error_at ? `<p style="font:12px/1.7 var(--pm-font-body);color:var(--pm-warn-text);margin:0 0 12px">最近のLINE通知が届けられませんでした（${escapeHtml(new Date(status.last_error_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}）。PhotoMatchのLINEをブロックしていないか確認してください。届かない場合は、連携を解除して設定し直してください。</p>` : ''}
      <button class="pm-btn-outline" id="line-unlink-btn" style="font-size:12px">連携を解除する</button>`;
    document.getElementById('line-unlink-btn').addEventListener('click', async (e) => {
      if (!confirm('LINE通知の連携を解除します。よろしいですか？（メールの通知は引き続き届きます）')) return;
      e.currentTarget.disabled = true;
      try { await lineLink('unlink'); } catch (err) { alert(err.message); }
      renderLineSection();
    });
    return;
  }
  el.innerHTML = `${title}
    ${note('予約や依頼者からのメッセージを、LINEでも受け取れます。メールに気づきにくい方はぜひ設定してください。')}
    <div id="line-steps"></div>
    <button class="pm-btn pm-btn-primary" id="line-start-btn" style="align-self:flex-start">LINEと連携する</button>`;
  document.getElementById('line-start-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    let issued;
    try {
      issued = await lineLink('code');
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      return;
    }
    btn.style.display = 'none';
    const linkBtn = (href, label) => (href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="pm-btn-outline" style="display:inline-flex;font-size:13px;text-decoration:none">${label}</a>` : '');
    document.getElementById('line-steps').innerHTML = `
      <ol style="font:13px/1.9 var(--pm-font-body);color:oklch(0.35 0.02 235);margin:0 0 12px;padding-left:20px">
        <li style="margin-bottom:10px">PhotoMatchのLINE公式アカウントを友だち追加します。<div style="margin-top:6px">${linkBtn(issued.add_friend_url, '友だち追加')}</div></li>
        <li>下のコードを、トークでそのまま送信します（30分有効）。<div style="font:800 24px/1.4 var(--pm-font-num);letter-spacing:2px;margin:6px 0">${escapeHtml(issued.code)}</div>${linkBtn(issued.send_code_url, 'LINEでコードを送信')}</li>
      </ol>
      <p id="line-waiting" style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin:0">送信すると、この画面が自動で「連携済み」に切り替わります。</p>`;
    // Watch for the webhook to finish linking (up to the code's 30 minutes).
    const until = Date.now() + 30 * 60e3;
    if (linePoll) clearInterval(linePoll);
    linePoll = setInterval(async () => {
      if (Date.now() > until) { clearInterval(linePoll); linePoll = null; return; }
      try {
        const s = await lineLink('status');
        if (s.linked) renderLineSection();
      } catch (err) { /* keep waiting */ }
    }, 4000);
  });
}

async function renderBankAccountSection(photographer) {
  const el = document.getElementById('pm-bank-account-section');
  const account = await getBankAccount(photographer.id);
  el.innerHTML = bankAccountFormHtml(account);

  document.getElementById('bank-account-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('bank-account-save-btn');
    const errorEl = document.getElementById('bank-account-error');
    const savedNote = document.getElementById('bank-account-saved-note');
    errorEl.style.display = 'none';
    savedNote.style.display = 'none';

    const fields = {
      bank_name: document.getElementById('f-bank-name').value.trim(),
      branch_name: document.getElementById('f-branch-name').value.trim(),
      account_type: document.getElementById('f-account-type').value,
      account_number: document.getElementById('f-account-number').value.trim(),
      account_holder_name: document.getElementById('f-account-holder').value.trim(),
    };
    if (Object.values(fields).some((v) => !v)) {
      errorEl.textContent = 'すべての項目をご入力ください。';
      errorEl.style.display = 'block';
      return;
    }
    // Full-width digits are common on phones; normalize, then check the shape
    // banks expect (振込に使う口座番号は7桁、名義はカタカナ).
    fields.account_number = fields.account_number.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    if (!/^\d{7}$/.test(fields.account_number)) {
      errorEl.textContent = '口座番号は7桁の数字で入力してください（7桁未満の場合は、先頭に0を付けてください）。';
      errorEl.style.display = 'block';
      return;
    }
    if (!/^[ァ-ヶー　 （）()．.・ヴ]+$/.test(fields.account_holder_name)) {
      errorEl.textContent = '口座名義は、通帳の表記どおりカタカナで入力してください（例：ヤマダ タロウ）。';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    try {
      await saveBankAccount(photographer.id, fields);
      savedNote.style.display = 'block';
      btn.textContent = '更新する';
    } catch (err) {
      errorEl.textContent = '保存に失敗しました。時間をおいて再度お試しください。';
      errorEl.style.display = 'block';
      console.error(err);
    } finally {
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
  state.area = AREAS.find((a) => a.label === photographer.area) || AREAS[0];
  document.getElementById('pm-admin').style.display = 'block';
  mountProfileEditor(document.getElementById('pm-profile-section'), photographer, profile.id);
  renderBankAccountSection(photographer);
  renderLineSection();

  const [bookings] = await Promise.all([getPhotographerBookings(state.photographerId), loadShifts(), loadWeather()]);
  state.bookings = bookings;
  computeTakenIntervals();
  renderGrid();
  await renderBookings();
}

init().catch((err) => {
  document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
  console.error(err);
});
