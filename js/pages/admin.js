import { mountLayout } from '../layout.js';
import { requireRole, signOut } from '../auth.js';
import {
  getMyPhotographerRow, getOpenShifts, openShifts, closeShifts,
  getPhotographerBookings, getMessageCounts, getReadTimestamps,
  getBankAccount, saveBankAccount,
} from '../repo.js';
import { mountChatModal } from '../chat.js';
import { loadDailyWeather } from '../weather.js';
import { mountProfileEditor } from '../profileEditor.js';
import { AREAS, SLOT_TIMES, TOTAL_BOOKING_DAYS, WEEKDAY_JP, PENDING_PAYMENT_HOLD_MIN, buildBookingDays, weatherIconFor } from '../data.js';
import { takenIntervalsFrom, openSetFrom, cellState as slotState } from '../availability.js';
import { escapeHtml } from '../util.js';

mountLayout();

const chatModal = mountChatModal(document.getElementById('pm-chat-mount'));

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

function bookingCardHtml(b, meta) {
  const statusLabel = STATUS_LABEL[b.status] || b.status;
  return `
  <div class="pm-card" style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div style="min-width:0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font:700 15px var(--pm-font-body)">${escapeHtml(b.customer_name || '依頼者')}</span>
        <span style="padding:3px 10px;border-radius:100px;font:700 11px var(--pm-font-body);white-space:nowrap;${STATUS_STYLE[statusLabel] || ''}">${escapeHtml(statusLabel)}</span>
      </div>
      <div style="font:13px var(--pm-font-body);color:oklch(0.45 0.02 235)">${b.booking_date}（${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}）</div>
      <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:2px">${escapeHtml(b.plan_name || '')}</div>
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
