import { mountLayout } from '../layout.js';
import { getSession } from '../auth.js';
import { getPhotographer, getPlans, getBooking, getTakenSlots, getClosedShifts } from '../repo.js';
import { mountSheetModal } from '../sheet.js';
import {
  AREAS, EXTRA_OPTIONS, SLOT_TIMES, TOTAL_BOOKING_DAYS, buildBookingDays, addMinutes, weatherIconFor, isoDate,
} from '../data.js';

mountLayout();

const params = new URLSearchParams(location.search);
const photographerId = params.get('id') || 'p1';
const planParam = params.get('plan');
const DRAFT_KEY = 'pm_booking_draft';

const steps = ['plan', 'slot', 'contact', 'payment', 'confirm'];
function showStep(name) {
  steps.forEach((s) => { document.getElementById('step-' + s).style.display = s === name ? '' : 'none'; });
  window.scrollTo({ top: 0 });
}

const sheetModal = mountSheetModal(document.getElementById('pm-sheet-mount'));

const state = {
  photographer: null,
  plans: [],
  selectedArea: 'nagoya',
  planIndex: null,
  dayIndex: null,
  slotIndex: null,
  options: [],
  name: '',
  contact: '',
  weather: null,
  days: buildBookingDays(TOTAL_BOOKING_DAYS),
  takenIntervals: {}, // iso -> [[startMin,endMin], ...]
  closedSet: new Set(), // `${iso}|${time}`
  lastBooking: null,
};

function saveDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
    photographerId, planIndex: state.planIndex, dayIndex: state.dayIndex, slotIndex: state.slotIndex,
    options: state.options, name: state.name, contact: state.contact, selectedArea: state.selectedArea,
  }));
}
function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.photographerId !== photographerId) return false;
    Object.assign(state, d);
    return true;
  } catch (e) { return false; }
}
function clearDraft() { sessionStorage.removeItem(DRAFT_KEY); }

function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

async function loadAvailability() {
  const fromIso = state.days[0].iso;
  const toIso = state.days[state.days.length - 1].iso;
  const [taken, closed] = await Promise.all([
    getTakenSlots(photographerId, fromIso, toIso),
    getClosedShifts(photographerId, fromIso, toIso),
  ]);
  state.takenIntervals = {};
  taken.forEach((row) => {
    const key = row.booking_date;
    state.takenIntervals[key] = state.takenIntervals[key] || [];
    state.takenIntervals[key].push([timeToMinutes(row.start_time), timeToMinutes(row.end_time)]);
  });
  state.closedSet = new Set(closed.filter((r) => !r.is_open).map((r) => `${r.shift_date}|${r.start_time.slice(0, 5)}`));
}

function cellTaken(iso, slotTime) {
  if (state.closedSet.has(`${iso}|${slotTime}`)) return true;
  const intervals = state.takenIntervals[iso] || [];
  const mins = timeToMinutes(slotTime);
  return intervals.some(([s, e]) => mins >= s && mins < e);
}

async function loadWeather() {
  state.weather = null;
  const area = AREAS.find((a) => a.key === state.selectedArea) || AREAS[0];
  // Open-Meteoの無料予報枠は「今日から最大16日先」まで。予約可能な最短日（3日後）を
  // 起点に+15日すると実質18日先までのリクエストになり、範囲外エラーで全日分の予報が
  // 取得できなくなっていた。今日を起点に計算し、日付文字列でstate.daysと突き合わせる
  // （予報範囲外の日は単にnullとなり、アイコン無しで自然にフォールバックする）。
  const start = isoDate(new Date());
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 15);
  const end = isoDate(endDate);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lon}&daily=weathercode,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const dates = (data.daily && data.daily.time) || [];
    const codes = (data.daily && data.daily.weathercode) || [];
    const pops = (data.daily && data.daily.precipitation_probability_max) || [];
    const byDate = {};
    dates.forEach((iso, i) => { byDate[iso] = { code: codes[i], pop: pops[i] }; });
    state.weather = state.days.map((d) => byDate[d.iso] || null);
  } catch (err) { /* weather is best-effort */ }
}

// ---------- render: plan select ----------
function renderPlanStep() {
  document.getElementById('plan-back-link').href = `profile.html?id=${photographerId}`;
  document.getElementById('plan-intro').textContent = `${state.photographer.name}さんのプランから選択してください。所要時間分の枠を次のステップで押さえます。`;
  document.getElementById('plan-list').innerHTML = state.plans.map((plan, idx) => `
    <div data-idx="${idx}" class="plan-card pm-card" style="cursor:pointer;border-radius:14px;padding:20px">
      <div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">${plan.name}</div>
      ${plan.original_price ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font:600 12px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${plan.original_price.toLocaleString()}</span>
        <span style="font:700 10px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 7px;border-radius:100px">${plan.discount_label || ''}</span>
      </div>` : ''}
      <div style="font:700 20px var(--pm-font-body);margin-bottom:2px">¥${plan.price.toLocaleString()}<span style="font:11px var(--pm-font-body);color:var(--pm-text-3)">（税込）</span></div>
      <div style="font:12px/1.6 var(--pm-font-body);color:var(--pm-text-3)">${plan.description || ''}</div>
    </div>`).join('');
  document.querySelectorAll('.plan-card').forEach((el) => {
    el.addEventListener('click', () => {
      state.planIndex = Number(el.dataset.idx);
      state.dayIndex = null; state.slotIndex = null;
      goSlotStep();
    });
  });
}

// ---------- render: slot select ----------
async function goSlotStep() {
  showStep('slot');
  document.getElementById('slot-back-link').href = '#';
  document.getElementById('slot-back-link').onclick = (e) => { e.preventDefault(); planParam != null ? (location.href = `profile.html?id=${photographerId}`) : showStep('plan'); };
  renderAreaChips();
  const plan = state.plans[state.planIndex];
  document.getElementById('slot-plan-line').textContent = `${plan.name}（${plan.duration_min}分）・タップした時間から即予約が確定します。`;
  document.getElementById('pm-loading-slot');
  await Promise.all([loadAvailability(), loadWeather()]);
  renderSlotGrid();
}

function renderAreaChips() {
  document.getElementById('area-chips').innerHTML = AREAS.map((a) => `
    <span data-key="${a.key}" class="pm-chip ${a.key === state.selectedArea ? 'is-active' : ''}">${a.label}</span>`).join('');
  document.querySelectorAll('#area-chips .pm-chip').forEach((el) => {
    el.addEventListener('click', async () => {
      state.selectedArea = el.dataset.key;
      renderAreaChips();
      document.getElementById('slot-weather-line').textContent = '天気予報を取得中…';
      await loadWeather();
      renderSlotGrid();
    });
  });
}

function renderSlotGrid() {
  const areaLabel = (AREAS.find((a) => a.key === state.selectedArea) || AREAS[0]).label;
  document.getElementById('slot-weather-line').textContent = `天気予報は「${areaLabel}」の予報です。ご予約は3日後から30日先まで承っています。`;

  const plan = state.plans[state.planIndex];
  const slotCount = Math.max(1, Math.ceil((plan.duration_min || 30) / 30));
  const grid = document.getElementById('slot-grid');
  grid.style.gridTemplateColumns = `48px repeat(${state.days.length}, minmax(44px,1fr))`;
  grid.style.minWidth = (48 + state.days.length * 46) + 'px';

  let html = '<div></div>';
  state.days.forEach((d, i) => {
    const w = state.weather && state.weather[i];
    const wi = weatherIconFor(w ? w.code : null);
    const pop = w && w.pop != null ? w.pop + '%' : '';
    html += `<div class="pm-cal-daylabel" style="color:${d.labelColor}">${d.label}<br><span style="font:400 11px var(--pm-font-num);color:var(--pm-text-3)">${d.dateLabel}</span><br><span style="font:700 17px var(--pm-font-body);color:${wi.color}">${wi.icon}</span> <span style="font:600 11px var(--pm-font-body);color:var(--pm-text-3)">${pop}</span></div>`;
  });

  SLOT_TIMES.forEach((time, slotIndex) => {
    html += `<div class="pm-cal-time">${time}</div>`;
    state.days.forEach((d) => {
      const taken = cellTaken(d.iso, time);
      let bookable = false;
      if (!taken) {
        bookable = slotIndex + slotCount <= SLOT_TIMES.length;
        for (let i = 1; i < slotCount && bookable; i++) {
          if (cellTaken(d.iso, SLOT_TIMES[slotIndex + i])) bookable = false;
        }
      }
      const bg = taken ? 'oklch(0.92 0.008 220)' : (bookable ? 'var(--pm-accent-grad)' : 'oklch(0.97 0.006 220)');
      const color = taken ? 'oklch(0.62 0.02 220)' : (bookable ? '#fff' : 'oklch(0.8 0.01 220)');
      const cursor = bookable ? 'pointer' : 'not-allowed';
      const mark = bookable ? '○' : (taken ? '×' : '−');
      html += `<div class="pm-cal-cell" data-day="${d.index}" data-slot="${slotIndex}" data-bookable="${bookable}" style="background:${bg};color:${color};cursor:${cursor};font-weight:${bookable ? 700 : 400}">${mark}</div>`;
    });
  });
  grid.innerHTML = html;

  grid.querySelectorAll('[data-bookable="true"]').forEach((el) => {
    el.addEventListener('click', () => {
      state.dayIndex = Number(el.dataset.day);
      state.slotIndex = Number(el.dataset.slot);
      goContactStep();
    });
  });
}

// ---------- render: contact ----------
function currentSummary() {
  const plan = state.plans[state.planIndex];
  const d = state.days[state.dayIndex];
  const startTime = SLOT_TIMES[state.slotIndex];
  const endTime = addMinutes(startTime, plan.duration_min || 30);
  const areaLabel = (AREAS.find((a) => a.key === state.selectedArea) || AREAS[0]).label;
  const selectedOptions = EXTRA_OPTIONS.filter((o) => state.options.includes(o.key));
  const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.price, 0);
  const grandTotal = plan.price + optionsTotal;
  return { plan, d, startTime, endTime, areaLabel, selectedOptions, optionsTotal, grandTotal };
}

function goContactStep() {
  showStep('contact');
  document.getElementById('contact-back-link').onclick = (e) => { e.preventDefault(); goSlotStep(); };
  const s = currentSummary();
  document.getElementById('contact-summary').innerHTML =
    `${state.photographer.name}さん ・ ${s.plan.name}（${s.plan.duration_min}分）<br>${s.d.dateLabel}（${s.d.label}） ${s.startTime}〜${s.endTime}<br>撮影エリア：${s.areaLabel}`;
  document.getElementById('f-name').value = state.name;
  document.getElementById('f-contact').value = state.contact;
  renderOptionTiles();
}

function renderOptionTiles() {
  document.getElementById('option-tiles').innerHTML = EXTRA_OPTIONS.map((o) => {
    const active = state.options.includes(o.key);
    return `<div data-key="${o.key}" class="option-tile" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;border:${active ? '2px solid oklch(0.62 0.14 210)' : '1px solid var(--pm-border)'};border-radius:12px;padding:14px 16px;background:${active ? 'var(--pm-bg-mint)' : '#fff'}">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="width:20px;height:20px;border-radius:6px;flex-shrink:0;${active ? 'background:var(--pm-brand-grad);color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif' : 'border:1.5px solid oklch(0.8 0.02 220)'}">${active ? '✓' : ''}</span>
        <div>
          <div style="font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 235)">${o.label}</div>
          <div style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${o.desc}</div>
        </div>
      </div>
      <div style="font:700 14px var(--pm-font-num);color:oklch(0.4 0.03 220);white-space:nowrap">+¥${o.price.toLocaleString()}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('.option-tile').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      state.options = state.options.includes(key) ? state.options.filter((k) => k !== key) : [...state.options, key];
      renderOptionTiles();
    });
  });
}

document.getElementById('contact-submit').addEventListener('click', async () => {
  const name = document.getElementById('f-name').value.trim();
  const contact = document.getElementById('f-contact').value.trim();
  document.getElementById('err-name').style.display = name ? 'none' : 'block';
  document.getElementById('err-contact').style.display = contact ? 'none' : 'block';
  if (!name || !contact) return;
  state.name = name; state.contact = contact;

  const session = await getSession();
  if (!session) {
    saveDraft();
    const next = encodeURIComponent(location.href);
    document.getElementById('auth-gate').style.display = 'block';
    document.getElementById('auth-gate-link').href = `login.html?next=${next}`;
    return;
  }
  goPaymentStep();
});

// ---------- render: payment ----------
function goPaymentStep() {
  showStep('payment');
  document.getElementById('payment-back-link').onclick = (e) => { e.preventDefault(); goContactStep(); };
  const s = currentSummary();
  const optionsHtml = s.selectedOptions.map((o) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font:12px var(--pm-font-body);color:oklch(0.5 0.03 220)">＋${o.label}</span>
      <span style="font:600 13px var(--pm-font-num);color:oklch(0.4 0.03 230)">+¥${o.price.toLocaleString()}</span>
    </div>`).join('');
  document.getElementById('payment-summary').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font:13px var(--pm-font-body);color:oklch(0.45 0.03 220)">${s.plan.name}（${s.plan.duration_min}分）</span>
      <span style="font:700 16px var(--pm-font-num);color:oklch(0.3 0.03 240)">¥${s.plan.price.toLocaleString()}</span>
    </div>
    ${optionsHtml}
    <div style="border-top:1px solid oklch(0.88 0.02 210);margin:10px 0 8px"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font:700 13px var(--pm-font-body);color:oklch(0.35 0.03 220)">合計（税込）</span>
      <span style="font:700 22px var(--pm-font-num);color:oklch(0.3 0.03 240)">¥${s.grandTotal.toLocaleString()}</span>
    </div>
    <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${state.photographer.name}さん ・ ${s.areaLabel} ・ ${s.d.dateLabel}（${s.d.label}） ${s.startTime}〜${s.endTime}</div>`;
  document.getElementById('payment-submit-label').textContent = `¥${s.grandTotal.toLocaleString()} を支払って予約を確定`;
}

document.getElementById('payment-submit').addEventListener('click', async () => {
  const errorEl = document.getElementById('err-payment');
  errorEl.style.display = 'none';
  const btn = document.getElementById('payment-submit');
  btn.disabled = true;
  const s = currentSummary();
  try {
    const session = await getSession();
    if (!session) throw new Error('ログインが必要です。');
    // Saved so a canceled/abandoned Stripe Checkout can restore this exact
    // slot/contact selection instead of losing it on the redirect back.
    saveDraft();
    const res = await fetch('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        photographer_id: photographerId,
        plan_name: s.plan.name,
        booking_date: s.d.iso,
        start_time: s.startTime,
        area: state.selectedArea,
        customer_name: state.name,
        customer_contact: state.contact,
        option_keys: state.options,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '決済ページの作成に失敗しました。');
    location.href = data.url;
  } catch (err) {
    errorEl.textContent = err.message || '決済ページの作成に失敗しました。時間をおいて再度お試しください。';
    errorEl.style.display = 'block';
    console.error(err);
    btn.disabled = false;
  }
});

// ---------- render: confirm ----------
// Rendered only after returning from Stripe Checkout with `?paid_booking=`,
// using the real booking row (the webhook is what actually marks it paid —
// this page never trusts the redirect alone).
function showConfirmForBooking(booking) {
  showStep('confirm');
  document.getElementById('confirm-lead').textContent = `${state.photographer.name}さんとの撮影が確定しました。当日は撮影場所で直接お待ち合わせください。`;
  const options = (booking.options || []).map((o) => EXTRA_OPTIONS.find((eo) => eo.key === o.key)).filter(Boolean);
  const optionsHtml = options.map((o) => `<div>＋オプション：${o.label}（+¥${o.price.toLocaleString()}）</div>`).join('');
  const dateLabel = `${Number(booking.booking_date.slice(5, 7))}/${Number(booking.booking_date.slice(8, 10))}`;
  document.getElementById('confirm-details').innerHTML = `
    <div>カメラマン：${state.photographer.name}</div>
    <div>撮影エリア：${booking.area}</div>
    <div>日時：${dateLabel} ${booking.start_time.slice(0, 5)}〜${booking.end_time.slice(0, 5)}</div>
    <div>プラン：${booking.plan_name}（¥${booking.plan_price.toLocaleString()}　税込）</div>
    ${optionsHtml}
    <div style="font:700 14px var(--pm-font-body);color:oklch(0.3 0.02 235)">お支払い合計：¥${booking.total_price.toLocaleString()}（税込）</div>
    <div>お支払い：Stripeで決済完了</div>
    <div>お名前：${booking.customer_name}</div>
    <div>連絡先：${booking.customer_contact}</div>`;
  document.getElementById('confirm-sheet-btn').onclick = () => {
    sheetModal.open(booking.id, `${dateLabel} ${booking.start_time.slice(0, 5)}〜 ・ ${state.photographer.name}さん`);
  };
}

// ---------- init ----------
(async () => {
  try {
    const [photographer, plans, session] = await Promise.all([
      getPhotographer(photographerId), getPlans(photographerId), getSession(),
    ]);
    state.photographer = photographer;
    state.plans = plans;

    // Returning from Stripe Checkout takes priority over everything else,
    // including the is_visible gate below — a booking that already succeeded
    // must still be viewable even if the photographer went unavailable since.
    const paidBookingId = params.get('paid_booking');
    const canceled = params.get('canceled');
    if (paidBookingId) {
      document.getElementById('pm-loading').remove();
      clearDraft();
      const booking = await getBooking(paidBookingId);
      showConfirmForBooking(booking);
      return;
    }

    if (photographer.is_visible === false) {
      document.getElementById('pm-loading').textContent = '現在、こちらのカメラマンは新規のご予約受付を休止しています。お手数ですが他のカメラマンをお探しください。';
      return;
    }
    document.getElementById('pm-loading').remove();

    // Set the expectation early that login is a one-time step at the end, so
    // hitting the auth gate mid-flow isn't a surprise. Pointless once signed in.
    if (!session) {
      document.querySelectorAll('.pm-login-hint').forEach((el) => { el.style.display = 'block'; });
    }

    const restored = restoreDraft();
    if (canceled && restored) {
      await goSlotStepFromRestore();
      goPaymentStep();
      const errorEl = document.getElementById('err-payment');
      errorEl.textContent = 'お支払いがキャンセルされました。内容をご確認の上、再度お試しください。';
      errorEl.style.display = 'block';
    } else if (restored) {
      goSlotStepFromRestore();
    } else if (planParam != null && plans[Number(planParam)]) {
      state.planIndex = Number(planParam);
      goSlotStep();
    } else {
      renderPlanStep();
      showStep('plan');
    }
  } catch (err) {
    const loadingEl = document.getElementById('pm-loading');
    if (loadingEl) loadingEl.textContent = '情報の取得に失敗しました。時間をおいて再度お試しください。';
    console.error(err);
  }
})();

async function goSlotStepFromRestore() {
  showStep('slot');
  await Promise.all([loadAvailability(), loadWeather()]);
  renderAreaChips();
  const plan = state.plans[state.planIndex];
  document.getElementById('slot-plan-line').textContent = `${plan.name}（${plan.duration_min}分）・タップした時間から即予約が確定します。`;
  renderSlotGrid();
  if (state.dayIndex != null && state.slotIndex != null) {
    goContactStep();
  }
}
