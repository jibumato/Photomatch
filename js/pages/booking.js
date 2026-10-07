import { mountLayout } from '../layout.js';
import { getSession, getProfile, signInOrSignUp, resendSignupEmail } from '../auth.js';
import { getPhotographer, getPlans, getBooking, getTakenSlots, getOpenShifts, isBookable, callApi, hasUnusedMonitorPrice } from '../repo.js';
import { mountSheetModal } from '../sheet.js';
import { loadDailyWeather } from '../weather.js';
import { takenIntervalsFrom, openSetFrom, isSlotTaken, canStartAt } from '../availability.js';
import { escapeHtml } from '../util.js';
import {
  AREAS, EXTRA_OPTIONS, bookingOptionItems, SLOT_TIMES, TOTAL_BOOKING_DAYS, buildBookingDays, addMinutes, weatherIconFor,
  MONITOR_PLAN_NAMES, monitorPriceFor, areasFor, meetingPointForArea, mapUrlFor,
  CUSTOMER_GENDERS, needsGenderForOptions,
} from '../data.js';
import { t, tf, L, getLang, areaText, weekdayText, planNameText, planDescText, discountLabelText, taxIncludedSuffix } from '../i18n.js';

mountLayout();

const params = new URLSearchParams(location.search);
const photographerId = params.get('id') || 'p1';
const planParam = params.get('plan');
const DRAFT_KEY = 'pm_booking_draft';

const steps = ['plan', 'slot', 'contact', 'payment', 'confirm'];
function showStep(name) {
  steps.forEach((s) => { document.getElementById('step-' + s).style.display = s === name ? '' : 'none'; });
  // The running-total bar only applies to the contact step (where options are
  // still being chosen); other steps show their own totals inline.
  document.getElementById('contact-sticky-bar').style.display = name === 'contact' ? '' : 'none';
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
  email: '',
  phone: '',
  gender: '',
  resumeToPayment: false,
  hasMonitorPrice: false, // signed-in customer has an unused モニター価格 (checked at the payment step)
  weather: null,
  days: buildBookingDays(TOTAL_BOOKING_DAYS),
  takenIntervals: {}, // iso -> [[startMin,endMin], ...]
  openSet: new Set(), // `${iso}|${time}` the photographer has opened (closed by default)
  lastBooking: null,
};

// The draft lives in localStorage (not sessionStorage) so it survives the
// sign-up confirmation link opening in a new tab. It expires after a day so a
// stale selection doesn't reappear on some later visit. The password is never
// stored.
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      savedAt: Date.now(),
      photographerId, planIndex: state.planIndex, dayIndex: state.dayIndex, slotIndex: state.slotIndex,
      options: state.options, name: state.name, email: state.email, phone: state.phone, gender: state.gender,
      selectedArea: state.selectedArea, resumeToPayment: state.resumeToPayment,
    }));
  } catch (e) { /* storage unavailable: the flow still works, just without restore */ }
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const { savedAt, ...d } = JSON.parse(raw);
    if (!savedAt || Date.now() - savedAt > DRAFT_TTL_MS) { clearDraft(); return false; }
    if (d.photographerId !== photographerId) return false;
    // Day/slot indexes are relative to today's booking window, so a draft from
    // an earlier day would point at a different date — drop the slot then.
    if (new Date(savedAt).toDateString() !== new Date().toDateString()) {
      d.dayIndex = null; d.slotIndex = null;
    }
    Object.assign(state, d);
    return true;
  } catch (e) { return false; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
}

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

// Logged-in customers only confirm what's already known (name from their
// profile, email from their account) — the password field disappears and the
// email is fixed to the account's address, which is where notifications go.
async function syncAuthFields() {
  const session = await getSession();
  const emailEl = document.getElementById('f-email');
  const hintEl = document.getElementById('email-hint');
  document.getElementById('password-field').style.display = session ? 'none' : '';
  updateGenderRequirement(session);
  if (session) {
    state.email = session.user.email || state.email;
    emailEl.value = state.email;
    emailEl.readOnly = true;
    hintEl.textContent = t('booking.contact.loggedInEmailHint');
    if (!state.name || !state.gender) {
      const profile = await getProfile();
      if (profile && profile.name && !state.name) {
        state.name = profile.name;
        document.getElementById('f-name').value = state.name;
      }
      if (profile && profile.gender && !state.gender) {
        state.gender = profile.gender;
        document.getElementById('f-gender').value = state.gender;
      }
    }
  } else {
    emailEl.readOnly = false;
    hintEl.textContent = t('booking.contact.emailHint');
  }
  return session;
}

// The gender dropdown is filled once. It is required when registering (the
// password field is showing) or when the 異性スタッフ写真セレクト option is chosen.
const genderEl = document.getElementById('f-gender');
genderEl.innerHTML = `<option value="">${t('login.gender.placeholder')}</option>`
  + CUSTOMER_GENDERS.map((g) => `<option value="${g.key}">${getLang() === 'en' ? g.labelEn : g.label}</option>`).join('');
genderEl.addEventListener('change', () => { state.gender = genderEl.value; document.getElementById('err-gender').style.display = 'none'; });

function genderRequired(session) {
  return !session || needsGenderForOptions(state.options);
}

function updateGenderRequirement(session) {
  document.getElementById('gender-req').style.display = genderRequired(session) ? '' : 'none';
}

// Returns an error message, or '' when the gender entered is acceptable.
function genderProblem(session) {
  if (genderRequired(session) && !state.gender) return t('booking.contact.genderError');
  if (needsGenderForOptions(state.options) && !['male', 'female'].includes(state.gender)) return t('booking.contact.genderOptionError');
  return '';
}

function showAuthNotice(html) {
  const el = document.getElementById('auth-notice');
  el.innerHTML = html;
  el.style.display = html ? 'block' : 'none';
}

async function loadAvailability() {
  const fromIso = state.days[0].iso;
  const toIso = state.days[state.days.length - 1].iso;
  const [taken, shifts] = await Promise.all([
    getTakenSlots(photographerId, fromIso, toIso),
    getOpenShifts(photographerId, fromIso, toIso),
  ]);
  state.takenIntervals = takenIntervalsFrom(taken);
  state.openSet = openSetFrom(shifts);
}

async function loadWeather() {
  state.weather = null;
  const area = AREAS.find((a) => a.key === state.selectedArea) || AREAS[0];
  state.weather = await loadDailyWeather(area, state.days);
}

// ---------- render: plan select ----------
function renderPlanStep() {
  document.getElementById('plan-back-link').href = `profile.html?id=${photographerId}`;
  document.getElementById('plan-intro').textContent = tf('booking.plan.intro', { name: state.photographer.name });
  document.getElementById('plan-list').innerHTML = state.plans.map((plan, idx) => `
    <button type="button" data-idx="${idx}" class="plan-card pm-card pm-unbutton" style="cursor:pointer;border-radius:14px;padding:20px">
      <div style="font:600 13px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">${planNameText(plan.name)}</div>
      ${plan.original_price ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font:600 12px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through">¥${plan.original_price.toLocaleString()}</span>
        <span style="font:700 10px var(--pm-font-body);color:#fff;background:var(--pm-warn);padding:2px 7px;border-radius:100px">${discountLabelText(plan.discount_label) || ''}</span>
      </div>` : ''}
      <div style="font:700 20px var(--pm-font-body);margin-bottom:2px">¥${plan.price.toLocaleString()}<span style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${taxIncludedSuffix()}</span></div>
      <div style="font:12px/1.6 var(--pm-font-body);color:var(--pm-text-3)">${planDescText(plan.description) || ''}</div>
    </button>`).join('');
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
  document.getElementById('slot-plan-line').textContent = tf('booking.slot.planLine', { plan: planNameText(plan.name), duration: plan.duration_min });
  document.getElementById('pm-loading-slot');
  await Promise.all([loadAvailability(), loadWeather()]);
  renderSlotGrid();
}

// Only the photographer's own area can be booked (a Nagoya photographer
// can't be booked for Gifu). Also fixes up a default/restored area that
// isn't one of theirs.
function allowedAreas() {
  const allowed = areasFor(state.photographer && state.photographer.area);
  if (!allowed.some((a) => a.key === state.selectedArea)) state.selectedArea = allowed[0].key;
  return allowed;
}

function renderAreaChips() {
  const allowed = allowedAreas();
  document.querySelector('[data-i18n="booking.slot.areaHeading"]').textContent = t(allowed.length > 1 ? 'booking.slot.areaHeading' : 'booking.slot.areaHeadingFixed');
  document.getElementById('area-chips').innerHTML = allowed.map((a) => `
    <span data-key="${a.key}" class="pm-chip ${a.key === state.selectedArea ? 'is-active' : ''}">${areaText(a.label)}</span>`).join('');
  renderAreaInfo();
  if (allowed.length < 2) return;
  document.querySelectorAll('#area-chips .pm-chip').forEach((el) => {
    el.addEventListener('click', async () => {
      state.selectedArea = el.dataset.key;
      renderAreaChips();
      document.getElementById('slot-weather-line').textContent = t('booking.slot.weatherLoading');
      await loadWeather();
      renderSlotGrid();
    });
  });
}

// What the selected area means on the day — where to meet — shown right
// under the area chips so nobody books the wrong city by mistake.
function renderAreaInfo() {
  const el = document.getElementById('area-info');
  const area = AREAS.find((a) => a.key === state.selectedArea);
  const mp = area && meetingPointForArea(area.label);
  if (!area || !mp) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `
    <span class="pm-note-title">${tf('booking.slot.areaInfoTitle', { area: areaText(area.label) })}</span>
    <div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-bottom:6px">${L(area, 'desc')}</div>
    <div style="font:13px/1.7 var(--pm-font-body);color:oklch(0.3 0.02 235)"><b>${t('booking.slot.meetingPoint')}</b>${escapeHtml(L(mp, 'detail'))}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font:700 12px var(--pm-font-body)">
      <a href="${mapUrlFor(mp)}" target="_blank" rel="noopener noreferrer" style="color:oklch(0.45 0.14 210)">${t('booking.slot.meetingMap')} ↗</a>
      <a href="meeting-points.html" target="_blank" rel="noopener" style="color:oklch(0.45 0.14 210)">${t('booking.slot.meetingMore')} ↗</a>
    </div>
    <div style="font:11px/1.7 var(--pm-font-body);color:var(--pm-text-muted);margin-top:6px">${t('booking.slot.meetingNote')}</div>`;
}

function renderSlotGrid() {
  const areaLabel = (AREAS.find((a) => a.key === state.selectedArea) || AREAS[0]).label;
  const weatherNote = state.weather ? tf('booking.slot.weatherFor', { area: areaText(areaLabel) }) : t('booking.slot.weatherFailed');
  // English needs a space between the two sentences; Japanese reads fine
  // running straight from one full stop into the next.
  const sep = getLang() === 'en' ? ' ' : '';
  document.getElementById('slot-weather-line').textContent = `${weatherNote}${sep}${t('booking.slot.windowNote')}`;

  const plan = state.plans[state.planIndex];
  const grid = document.getElementById('slot-grid');
  grid.style.gridTemplateColumns = `48px repeat(${state.days.length}, minmax(44px,1fr))`;
  grid.style.minWidth = (48 + state.days.length * 46) + 'px';

  let html = '<div></div>';
  state.days.forEach((d, i) => {
    const w = state.weather && state.weather[i];
    const wi = weatherIconFor(w ? w.code : null);
    const pop = w && w.pop != null ? w.pop + '%' : '';
    html += `<div class="pm-cal-daylabel" style="color:${d.labelColor}">${weekdayText(d.label)}<br><span style="font:400 11px var(--pm-font-num);color:var(--pm-text-3)">${d.dateLabel}</span><br><span style="font:700 17px var(--pm-font-body);color:${wi.color}">${wi.icon}</span> <span style="font:600 11px var(--pm-font-body);color:var(--pm-text-3)">${pop}</span></div>`;
  });

  SLOT_TIMES.forEach((time, slotIndex) => {
    html += `<div class="pm-cal-time">${time}</div>`;
    state.days.forEach((d) => {
      // taken = already booked; a slot the photographer hasn't opened (or that
      // is too short for this plan) is just "not available", shown as −.
      const taken = isSlotTaken(state.takenIntervals, d.iso, time);
      const bookable = canStartAt(state.takenIntervals, state.openSet, d.iso, slotIndex, plan.duration_min);
      const bg = taken ? 'oklch(0.92 0.008 220)' : (bookable ? 'var(--pm-accent-grad)' : 'oklch(0.97 0.006 220)');
      const color = taken ? 'oklch(0.62 0.02 220)' : (bookable ? '#fff' : 'oklch(0.8 0.01 220)');
      const mark = bookable ? '○' : (taken ? '×' : '−');
      // Only the bookable cells are real (focusable, keyboard-activatable)
      // buttons — the rest are informational, not actions, so they stay plain
      // divs and don't add noise to the tab order.
      html += bookable
        ? `<button type="button" class="pm-cal-cell pm-unbutton" data-day="${d.index}" data-slot="${slotIndex}" data-bookable="true" aria-label="${getLang() === 'en' ? `${d.dateLabel} (${weekdayText(d.label)}) ${time}` : `${d.dateLabel}（${d.label}） ${time}〜`}" style="background:${bg};color:${color};cursor:pointer;font-weight:700;border:0;padding:0;width:100%">${mark}</button>`
        : `<div class="pm-cal-cell" style="background:${bg};color:${color};cursor:not-allowed;font-weight:400">${mark}</div>`;
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
  const monitor = state.hasMonitorPrice && MONITOR_PLAN_NAMES.includes(plan.name);
  const planPrice = monitor ? monitorPriceFor(plan.price) : plan.price;
  const grandTotal = planPrice + optionsTotal;
  return { plan, d, startTime, endTime, areaLabel, selectedOptions, optionsTotal, grandTotal, monitor, planPrice };
}

function updateContactStickyTotal() {
  document.getElementById('contact-sticky-total').textContent = `¥${currentSummary().grandTotal.toLocaleString()}`;
}

function goContactStep() {
  showStep('contact');
  document.getElementById('contact-back-link').onclick = (e) => { e.preventDefault(); goSlotStep(); };
  const s = currentSummary();
  document.getElementById('contact-summary').innerHTML = tf('booking.contact.summary', {
    name: state.photographer.name, plan: planNameText(s.plan.name), duration: s.plan.duration_min,
    date: s.d.dateLabel, day: weekdayText(s.d.label), start: s.startTime, end: s.endTime, area: areaText(s.areaLabel),
  });
  document.getElementById('f-name').value = state.name;
  document.getElementById('f-email').value = state.email;
  document.getElementById('f-phone').value = state.phone;
  genderEl.value = state.gender || '';
  document.getElementById('err-gender').style.display = 'none';
  document.getElementById('f-password').value = '';
  document.getElementById('err-password').style.display = 'none';
  showAuthNotice('');
  renderOptionTiles();
  updateContactStickyTotal();
  syncAuthFields();
}

function renderOptionTiles() {
  document.getElementById('option-tiles').innerHTML = EXTRA_OPTIONS.map((o) => {
    const active = state.options.includes(o.key);
    return `<button type="button" data-key="${o.key}" class="option-tile pm-unbutton" aria-pressed="${active}" style="cursor:pointer;width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;border:${active ? '2px solid oklch(0.62 0.14 210)' : '1px solid var(--pm-border)'};border-radius:12px;padding:14px 16px;background:${active ? 'var(--pm-bg-mint)' : '#fff'}">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="width:20px;height:20px;border-radius:6px;flex-shrink:0;${active ? 'background:var(--pm-brand-grad);color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif' : 'border:1.5px solid oklch(0.8 0.02 220)'}">${active ? '✓' : ''}</span>
        <div>
          <div style="font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 235)">${L(o, 'label')}</div>
          <div style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${L(o, 'desc')}</div>
        </div>
      </div>
      <div style="font:700 14px var(--pm-font-num);color:oklch(0.4 0.03 220);white-space:nowrap">+¥${o.price.toLocaleString()}</div>
    </button>`;
  }).join('');
  document.querySelectorAll('.option-tile').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      state.options = state.options.includes(key) ? state.options.filter((k) => k !== key) : [...state.options, key];
      renderOptionTiles();
      updateContactStickyTotal();
      getSession().then(updateGenderRequirement);
      // renderOptionTiles() rebuilds every tile's markup, which would
      // otherwise drop keyboard focus off the tile the person just toggled —
      // restore it to the (new) element for the same option key.
      document.querySelector(`.option-tile[data-key="${key}"]`)?.focus();
    });
  });
}

function confirmRedirectUrl() {
  return `${location.origin}${location.pathname}?id=${encodeURIComponent(photographerId)}`;
}

document.getElementById('contact-submit').addEventListener('click', async () => {
  const btn = document.getElementById('contact-submit');
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const passwordEl = document.getElementById('f-password');
  const passwordErr = document.getElementById('err-password');
  document.getElementById('err-name').style.display = name ? 'none' : 'block';
  document.getElementById('err-email').style.display = isValidEmail(email) ? 'none' : 'block';
  passwordErr.style.display = 'none';
  showAuthNotice('');
  // The submit button is now a fixed bar at the bottom of the screen, so a
  // field error further up the form could otherwise go unseen — scroll it
  // into view rather than relying on the button and the error being adjacent.
  if (!name) { document.getElementById('f-name').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (!isValidEmail(email)) { document.getElementById('f-email').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  state.name = name; state.email = email; state.phone = phone;

  const session = await getSession();
  const genderError = genderProblem(session);
  const genderErrEl = document.getElementById('err-gender');
  genderErrEl.textContent = genderError;
  genderErrEl.style.display = genderError ? 'block' : 'none';
  if (genderError) { genderEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (session) { goPaymentStep(); return; }

  const password = passwordEl.value;
  if (password.length < 6) {
    passwordErr.textContent = t('booking.contact.passwordTooShort');
    passwordErr.style.display = 'block';
    passwordEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  btn.disabled = true;
  try {
    // Saved before signing up so the confirmation link (which may open in a
    // new tab) lands back here with everything still filled in.
    state.resumeToPayment = false;
    saveDraft();
    const result = await signInOrSignUp({ email, password, name, gender: state.gender, redirectTo: confirmRedirectUrl() });
    if (result.status === 'signed_in') {
      goPaymentStep();
    } else if (result.status === 'wrong_password') {
      passwordErr.textContent = t('booking.contact.wrongPassword');
      passwordErr.style.display = 'block';
      // Reset link returns here with the draft intact and goes straight to
      // payment, so forgetting the password doesn't mean starting over.
      const resetUrl = new URL('reset-password.html', location.href);
      resetUrl.searchParams.set('email', email);
      resetUrl.searchParams.set('next', confirmRedirectUrl());
      showAuthNotice(`<span class="pm-note-title">${t('booking.contact.forgotTitle')}</span><a href="${resetUrl.href}" id="forgot-in-booking" style="color:oklch(0.45 0.14 210);font-weight:700">${t('booking.contact.forgotLink')}</a>${t('booking.contact.forgotSuffix')}`);
      document.getElementById('forgot-in-booking').onclick = () => { state.resumeToPayment = true; saveDraft(); };
    } else {
      // confirm_email / email_not_confirmed: the account exists but the
      // session only starts once the emailed link is opened.
      state.resumeToPayment = true;
      saveDraft();
      showAuthNotice(`<span class="pm-note-title">${t('booking.contact.confirmEmailTitle')}</span>${tf('booking.contact.confirmEmailBody', { email: email.replace(/[<>&"]/g, '') })}<br><a href="#" id="resend-confirm" style="color:oklch(0.45 0.14 210);font-weight:700">${t('booking.contact.resendLink')}</a>`);
      document.getElementById('resend-confirm').onclick = async (e) => {
        e.preventDefault();
        try {
          await resendSignupEmail(email, confirmRedirectUrl());
          e.target.textContent = t('booking.contact.resendDone');
        } catch (err) {
          e.target.textContent = t('booking.contact.resendFailed');
          console.error(err);
        }
      };
    }
  } catch (err) {
    passwordErr.textContent = /rate limit|too many/i.test(err.message || '')
      ? t('booking.contact.rateLimited')
      : t('booking.contact.authFailed');
    passwordErr.style.display = 'block';
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ---------- render: payment ----------
function goPaymentStep() {
  showStep('payment');
  document.getElementById('payment-back-link').onclick = (e) => { e.preventDefault(); goContactStep(); };
  renderPaymentSummary();
  // The customer is signed in by now; show the モニター価格 if they still
  // have one. The checkout Function applies it on its own either way.
  hasUnusedMonitorPrice().then((has) => {
    if (has === state.hasMonitorPrice) return;
    state.hasMonitorPrice = has;
    renderPaymentSummary();
  }).catch((err) => console.error(err));
}

function renderPaymentSummary() {
  const s = currentSummary();
  const optionsHtml = s.selectedOptions.map((o) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font:12px var(--pm-font-body);color:oklch(0.5 0.03 220)">${tf('booking.payment.optionLine', { label: L(o, 'label') })}</span>
      <span style="font:600 13px var(--pm-font-num);color:oklch(0.4 0.03 230)">+¥${o.price.toLocaleString()}</span>
    </div>`).join('');
  document.getElementById('payment-summary').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font:13px var(--pm-font-body);color:oklch(0.45 0.03 220)">${tf('booking.payment.summaryDuration', { plan: planNameText(s.plan.name), duration: s.plan.duration_min })}</span>
      <span style="font:700 16px var(--pm-font-num);color:oklch(0.3 0.03 240)">${s.monitor ? `<span style="font:600 12px var(--pm-font-num);color:var(--pm-text-muted);text-decoration:line-through;margin-right:6px">¥${s.plan.price.toLocaleString()}</span>` : ''}¥${s.planPrice.toLocaleString()}</span>
    </div>
    ${s.monitor ? `<div style="font:700 12px var(--pm-font-body);color:oklch(0.45 0.14 160);margin-bottom:8px">${t('booking.payment.monitorApplied')}</div>` : ''}
    ${optionsHtml}
    <div style="border-top:1px solid oklch(0.88 0.02 210);margin:10px 0 8px"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font:700 13px var(--pm-font-body);color:oklch(0.35 0.03 220)">${t('booking.contact.total')}</span>
      <span style="font:700 22px var(--pm-font-num);color:oklch(0.3 0.03 240)">¥${s.grandTotal.toLocaleString()}</span>
    </div>
    ${meetingPointForArea(s.areaLabel) ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:4px">${tf('booking.payment.meetingLine', { detail: escapeHtml(L(meetingPointForArea(s.areaLabel), 'detail')) })}</div>` : ''}
    <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${tf('booking.payment.locationLine', { name: escapeHtml(state.photographer.name), area: areaText(s.areaLabel), date: s.d.dateLabel, day: weekdayText(s.d.label), start: s.startTime, end: s.endTime })}</div>`;
  document.getElementById('payment-submit-label').textContent = tf('booking.payment.submitLabel', { total: `¥${s.grandTotal.toLocaleString()}` });
}

document.getElementById('payment-submit').addEventListener('click', async () => {
  const errorEl = document.getElementById('err-payment');
  errorEl.style.display = 'none';
  const btn = document.getElementById('payment-submit');
  btn.disabled = true;
  const s = currentSummary();
  try {
    const session = await getSession();
    if (!session) throw new Error(t('booking.payment.loginRequired'));
    if (!state.email) state.email = session.user.email || '';
    // Saved so a canceled/abandoned Stripe Checkout can restore this exact
    // slot/contact selection instead of losing it on the redirect back.
    saveDraft();
    const data = await callApi('/api/checkout/create-session', {
      photographer_id: photographerId,
      plan_name: s.plan.name,
      booking_date: s.d.iso,
      start_time: s.startTime,
      area: state.selectedArea,
      customer_name: state.name,
      // Photographers see this in their booking list, so include the phone
      // number when one was given — the email alone otherwise.
      customer_contact: state.phone ? `${state.email} / ${state.phone}` : state.email,
      option_keys: state.options,
      customer_gender: state.gender || undefined,
    }, t('booking.payment.checkoutFailed'), t('booking.payment.checkoutFailedRetry'));
    location.href = data.url;
  } catch (err) {
    errorEl.textContent = err.message || t('booking.payment.checkoutFailedRetry');
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
  document.getElementById('confirm-lead').textContent = tf('booking.confirm.lead', { name: state.photographer.name });
  const options = bookingOptionItems(booking);
  const optionsHtml = options.map((o) => `<div>${tf('booking.confirm.optionLine', { label: L(o, 'label'), price: o.price.toLocaleString() })}</div>`).join('');
  const dateLabel = `${Number(booking.booking_date.slice(5, 7))}/${Number(booking.booking_date.slice(8, 10))}`;
  document.getElementById('confirm-details').innerHTML = `
    ${booking.order_number ? `<div style="font:700 14px var(--pm-font-num);color:oklch(0.3 0.02 235)">${tf('booking.confirm.orderNumber', { n: escapeHtml(booking.order_number) })}</div>` : ''}
    <div>${tf('booking.confirm.photographer', { name: escapeHtml(state.photographer.name) })}</div>
    <div>${tf('booking.confirm.area', { area: areaText(booking.area) })}</div>
    <div>${tf('booking.confirm.datetime', { date: dateLabel, start: booking.start_time.slice(0, 5), end: booking.end_time.slice(0, 5) })}</div>
    <div>${tf('booking.confirm.plan', { plan: planNameText(booking.plan_name), price: booking.plan_price.toLocaleString() })}</div>
    ${optionsHtml}
    <div style="font:700 14px var(--pm-font-body);color:oklch(0.3 0.02 235)">${tf('booking.confirm.total', { total: booking.total_price.toLocaleString() })}</div>
    <div>${t('booking.confirm.paidVia')}</div>
    <div>${tf('booking.confirm.customerName', { name: booking.customer_name })}</div>
    <div>${tf('booking.confirm.customerContact', { contact: booking.customer_contact })}</div>`;
  document.getElementById('confirm-sheet-btn').onclick = () => {
    sheetModal.open(booking.id, tf('booking.confirm.sheetOpenTitle', { date: dateLabel, start: booking.start_time.slice(0, 5), name: state.photographer.name }));
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
      // The redirect back from Stripe can arrive before the webhook has
      // marked the booking paid: wait for it instead of claiming success.
      let booking = await getBooking(paidBookingId);
      if (booking.status === 'pending_payment') {
        showStep('confirm');
        document.querySelector('[data-i18n="booking.confirm.title"]').textContent = t('booking.confirm.checkingTitle');
        document.getElementById('confirm-lead').textContent = t('booking.confirm.checkingLead');
        for (let i = 0; i < 20 && booking.status === 'pending_payment'; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          booking = await getBooking(paidBookingId);
        }
      }
      if (booking.status === 'pending_payment' || booking.status === 'canceled') {
        showStep('confirm');
        document.querySelector('[data-i18n="booking.confirm.title"]').textContent = t(booking.status === 'canceled' ? 'booking.confirm.failedTitle' : 'booking.confirm.slowTitle');
        document.getElementById('confirm-lead').textContent = t(booking.status === 'canceled' ? 'booking.confirm.failedLead' : 'booking.confirm.slowLead');
        document.getElementById('confirm-details').closest('.pm-card').style.display = 'none';
        return;
      }
      document.querySelector('[data-i18n="booking.confirm.title"]').textContent = t('booking.confirm.title');
      showConfirmForBooking(booking);
      return;
    }

    if (!isBookable(photographer)) {
      document.getElementById('pm-loading').textContent = t('booking.paused');
      return;
    }
    document.getElementById('pm-loading').remove();

    // Set the expectation early that login is a one-time step at the end, so
    // hitting the auth gate mid-flow isn't a surprise. Pointless once signed in.
    if (!session) {
      document.querySelectorAll('.pm-login-hint').forEach((el) => { el.style.display = 'block'; });
    }

    const restored = restoreDraft();
    allowedAreas();
    if (canceled && restored) {
      await goSlotStepFromRestore();
      goPaymentStep();
      const errorEl = document.getElementById('err-payment');
      errorEl.textContent = t('booking.payment.canceledNotice');
      errorEl.style.display = 'block';
    } else if (restored && state.resumeToPayment && session && state.dayIndex != null && state.slotIndex != null) {
      // Back from the sign-up confirmation or password-reset link: everything
      // was already entered, so go straight to payment.
      state.resumeToPayment = false;
      saveDraft();
      await goSlotStepFromRestore();
      goPaymentStep();
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
    if (loadingEl) loadingEl.textContent = t('booking.loadError');
    console.error(err);
  }
})();

async function goSlotStepFromRestore() {
  showStep('slot');
  await Promise.all([loadAvailability(), loadWeather()]);
  renderAreaChips();
  const plan = state.plans[state.planIndex];
  document.getElementById('slot-plan-line').textContent = tf('booking.slot.planLine', { plan: planNameText(plan.name), duration: plan.duration_min });
  renderSlotGrid();
  if (state.dayIndex != null && state.slotIndex != null) {
    goContactStep();
  }
}
