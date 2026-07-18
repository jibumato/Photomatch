import { mountLayout } from '../layout.js';
import { getSession } from '../auth.js';
import { getPhotographer, getPlans, createBooking, getTakenSlots, getClosedShifts } from '../repo.js';
import { mountSheetModal } from '../sheet.js';
import {
  AREAS, EXTRA_OPTIONS, SLOT_TIMES, TOTAL_BOOKING_DAYS, buildBookingDays, addMinutes, weatherIconFor,
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
  const start = state.days[0].iso;
  const endDate = new Date(state.days[0].date);
  endDate.setDate(endDate.getDate() + 15);
  const end = endDate.toISOString().slice(0, 10);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lon}&daily=weathercode,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const codes = (data.daily && data.daily.weathercode) || [];
    const pops = (data.daily && data.daily.precipitation_probability_max) || [];
    state.weather = codes.map((code, i) => ({ code, pop: pops[i] }));
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
  const number = document.getElementById('f-card-number').value;
  const name = document.getElementById('f-card-name').value.trim();
  const exp = document.getElementById('f-card-exp').value.trim();
  const cvc = document.getElementById('f-card-cvc').value.trim();
  const digits = number.replace(/\s/g, '');
  const errors = {
    'err-card-number': digits.length < 14,
    'err-card-name': !name,
    'err-card-exp': !/^\d{2}\/\d{2}$/.test(exp),
    'err-card-cvc': !/^\d{3,4}$/.test(cvc),
  };
  Object.entries(errors).forEach(([id, hasError]) => { document.getElementById(id).style.display = hasError ? 'block' : 'none'; });
  if (Object.values(errors).some(Boolean)) return;

  const btn = document.getElementById('payment-submit');
  btn.disabled = true;
  const s = currentSummary();
  try {
    const booking = await createBooking({
      photographer_id: photographerId,
      plan_name: s.plan.name,
      plan_price: s.plan.price,
      duration_min: s.plan.duration_min,
      area: s.areaLabel,
      booking_date: s.d.iso,
      start_time: s.startTime,
      end_time: s.endTime,
      customer_name: state.name,
      customer_contact: state.contact,
      options: s.selectedOptions.map((o) => ({ key: o.key, label: o.label, price: o.price })),
      options_total: s.optionsTotal,
      total_price: s.grandTotal,
      status: 'paid',
    });
    state.lastBooking = booking;
    clearDraft();
    goConfirmStep(s);
  } catch (err) {
    alert('予約の確定に失敗しました。時間をおいて再度お試しください。');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ---------- render: confirm ----------
function goConfirmStep(s) {
  showStep('confirm');
  document.getElementById('confirm-lead').textContent = `${state.photographer.name}さんとの撮影が確定しました。当日は撮影場所で直接お待ち合わせください。`;
  const optionsHtml = s.selectedOptions.map((o) => `<div>＋オプション：${o.label}（+¥${o.price.toLocaleString()}）</div>`).join('');
  document.getElementById('confirm-details').innerHTML = `
    <div>カメラマン：${state.photographer.name}</div>
    <div>撮影エリア：${s.areaLabel}</div>
    <div>日時：${s.d.dateLabel}（${s.d.label}） ${s.startTime}〜${s.endTime}</div>
    <div>プラン：${s.plan.name}（¥${s.plan.price.toLocaleString()}　税込）</div>
    ${optionsHtml}
    <div style="font:700 14px var(--pm-font-body);color:oklch(0.3 0.02 235)">お支払い合計：¥${s.grandTotal.toLocaleString()}（税込）</div>
    <div>お支払い：クレジットカードで決済完了</div>
    <div>お名前：${state.name}</div>
    <div>連絡先：${state.contact}</div>`;
  document.getElementById('confirm-sheet-btn').onclick = () => {
    sheetModal.open(state.lastBooking.id, `${s.d.dateLabel} ${s.startTime}〜 ・ ${state.photographer.name}さん`);
  };
}

// ---------- init ----------
(async () => {
  try {
    const [photographer, plans] = await Promise.all([getPhotographer(photographerId), getPlans(photographerId)]);
    state.photographer = photographer;
    state.plans = plans;
    document.getElementById('pm-loading').remove();

    const restored = restoreDraft();
    if (restored) {
      goSlotStepFromRestore();
    } else if (planParam != null && plans[Number(planParam)]) {
      state.planIndex = Number(planParam);
      goSlotStep();
    } else {
      renderPlanStep();
      showStep('plan');
    }
  } catch (err) {
    document.getElementById('pm-loading').textContent = 'カメラマン情報の取得に失敗しました。';
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
