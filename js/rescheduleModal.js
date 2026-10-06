// 日程変更のモーダル（マイページ）。同じカメラマン・同じプランで、日時だけを動かす。
// 選べるのは、カメラマンが受け付けている空き枠（予約画面と同じ判定: js/availability.js）。
// ルール（無料の範囲・あんしん振替プランの1回）の判定とサーバーでの確認は、
// js/data.js の rescheduleQuote と /api/bookings/reschedule。
import { t, tf, planNameText } from './i18n.js';
import { jaText } from './i18n/mypage.js';
import { getTakenSlots, getOpenShifts, rescheduleBooking, createReshoot } from './repo.js';
import { SLOT_TIMES, TOTAL_BOOKING_DAYS, buildBookingDays, addMinutes, rescheduleQuote } from './data.js';
import { takenIntervalsFrom, openSetFrom, canStartAt, timeToMinutes } from './availability.js';
import { escapeHtml } from './util.js';

// The ops screen also uses this modal and stays Japanese (asOps); the
// customer's My Page follows the visitor's language.
export function mountRescheduleModal(container) {
  let asOpsMode = false;
  const tr = (key, vars) => (asOpsMode ? jaText(key, vars) : (vars ? tf(key, vars) : t(key)));

  container.innerHTML = `
  <div class="pm-modal-overlay" id="resched-overlay">
    <div class="pm-modal-backdrop" id="resched-backdrop"></div>
    <div class="pm-modal-sheet pm-sheet-modal" style="height:auto;max-height:92vh" role="dialog" aria-modal="true" aria-labelledby="resched-title">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="resched-title" style="font:700 16px var(--pm-font-body);color:oklch(0.24 0.02 245)">${t('resched.title')}</div>
          <div id="resched-booking-label" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="resched-close" aria-label="${t('resched.close')}">×</button>
      </div>
      <div class="pm-sheet-body">
        <p id="resched-rule" style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 14px;padding:12px 14px;background:oklch(0.97 0.015 210);border-radius:12px"></p>
        <div id="resched-loading" class="pm-loading">${t('resched.loading')}</div>
        <div id="resched-picker" style="display:none">
          <div id="resched-pick-date" style="font:700 13px var(--pm-font-body);margin-bottom:8px">${t('resched.pickDate')}</div>
          <div id="resched-days" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px"></div>
          <div id="resched-pick-time" style="font:700 13px var(--pm-font-body);margin-bottom:8px">${t('resched.pickTime')}</div>
          <div id="resched-times" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        </div>
        <div class="pm-error-text" id="resched-error" style="display:none;margin-top:10px"></div>
      </div>
      <div class="pm-sheet-foot">
        <div id="resched-selected" style="flex:1;align-self:center;font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 235)"></div>
        <button class="pm-btn" id="resched-save" disabled style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:13px 22px;font:700 14px var(--pm-font-body);color:#fff;opacity:0.5">${t('resched.save')}</button>
      </div>
    </div>
  </div>`;

  const $ = (id) => container.querySelector('#' + id);
  const overlay = $('resched-overlay');
  let current = null; // { booking, quote, days, taken, openSet, dayIso, time, onDone }

  function close() { overlay.classList.remove('is-open'); current = null; }
  $('resched-close').addEventListener('click', close);
  $('resched-backdrop').addEventListener('click', close);

  const showError = (msg) => { const el = $('resched-error'); el.textContent = msg; el.style.display = msg ? 'block' : 'none'; };

  // Start times that fit on this day (the booking's own current slot counts as free).
  // Weekday label in the modal's language (js/data.js's d.label is Japanese-only).
  const weekday = (d) => tr('resched.wd.' + d.date.getDay());
  const whenText = (day, time, mins) => tr('resched.selected', { date: day.dateLabel, wd: weekday(day), start: time, end: addMinutes(time, mins) });

  function startsFor(iso) {
    const slotIndexes = [];
    SLOT_TIMES.forEach((_, i) => {
      if (canStartAt(current.taken, current.openSet, iso, i, current.booking.duration_min)) slotIndexes.push(i);
    });
    return slotIndexes;
  }

  function renderDays() {
    const withSlots = current.days.filter((d) => startsFor(d.iso).length);
    if (!withSlots.length) {
      $('resched-days').innerHTML = '';
      $('resched-times').innerHTML = '';
      showError(tr('resched.noSlots'));
      return;
    }
    $('resched-days').innerHTML = withSlots.map((d) => {
      const active = d.iso === current.dayIso;
      return `<button type="button" data-iso="${d.iso}" class="resched-day pm-unbutton" aria-pressed="${active}" style="flex:0 0 auto;cursor:pointer;min-width:58px;text-align:center;padding:8px 6px;border-radius:12px;border:${active ? '2px solid oklch(0.62 0.14 210)' : '1px solid var(--pm-border)'};background:${active ? 'var(--pm-bg-mint)' : '#fff'}">
        <div style="font:700 12px var(--pm-font-body);color:${d.labelColor}">${weekday(d)}</div>
        <div style="font:700 14px var(--pm-font-num)">${d.dateLabel}</div>
      </button>`;
    }).join('');
    $('resched-days').querySelectorAll('.resched-day').forEach((b) => b.addEventListener('click', () => {
      current.dayIso = b.dataset.iso; current.time = null; renderDays(); renderTimes(); renderSelected();
    }));
  }

  function renderTimes() {
    if (!current.dayIso) { $('resched-times').innerHTML = `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${tr('resched.dateFirst')}</div>`; return; }
    $('resched-times').innerHTML = startsFor(current.dayIso).map((i) => {
      const time = SLOT_TIMES[i];
      const active = time === current.time;
      return `<button type="button" data-time="${time}" class="resched-time pm-unbutton" aria-pressed="${active}" style="cursor:pointer;padding:9px 14px;border-radius:100px;border:${active ? '2px solid oklch(0.62 0.14 210)' : '1px solid var(--pm-border)'};background:${active ? 'var(--pm-bg-mint)' : '#fff'};font:700 13px var(--pm-font-num)">${time}</button>`;
    }).join('');
    $('resched-times').querySelectorAll('.resched-time').forEach((b) => b.addEventListener('click', () => {
      current.time = b.dataset.time; renderTimes(); renderSelected();
    }));
  }

  function renderSelected() {
    const ready = current.dayIso && current.time;
    const day = current.days.find((d) => d.iso === current.dayIso);
    $('resched-selected').textContent = ready ? whenText(day, current.time, current.booking.duration_min) : '';
    const btn = $('resched-save');
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '0.5';
  }

  $('resched-save').addEventListener('click', async () => {
    if (!current || !current.dayIso || !current.time) return;
    const day = current.days.find((d) => d.iso === current.dayIso);
    const planNote = current.quote.usesPlan ? '\n\n' + tr('resched.planNote') : '';
    const when = whenText(day, current.time, current.booking.duration_min);
    const reshoot = current.reshootClaimId;
    if (reshoot && !confirm(tr('resched.confirmReshoot', { when }))) return;
    if (!reshoot && !confirm(tr('resched.confirm', { when, planNote }))) return;
    const btn = $('resched-save');
    btn.disabled = true;
    showError('');
    try {
      if (reshoot) await createReshoot(reshoot, current.dayIso, current.time);
      else await rescheduleBooking(current.booking.id, current.dayIso, current.time);
      const done = current.onDone;
      const asOps = current.asOps;
      close();
      alert(reshoot ? tr('resched.doneReshoot') : asOps ? tr('resched.doneOps') : tr('resched.done'));
      if (done) done();
    } catch (err) {
      showError(err.message || tr('resched.failed'));
      btn.disabled = false;
      // The slot may have just been taken: refresh what is offered.
      if (current) { try { await load(); } catch (e) { /* keep what is shown */ } }
    }
  });

  async function load() {
    const days = current.days;
    const [taken, shifts] = await Promise.all([
      getTakenSlots(current.booking.photographer_id, days[0].iso, days[days.length - 1].iso),
      getOpenShifts(current.booking.photographer_id, days[0].iso, days[days.length - 1].iso),
    ]);
    // The booking's own slot is still marked taken in booking_slots; it is
    // free to move within, so leave it out.
    const own = (r) => r.booking_date === current.booking.booking_date
      && timeToMinutes(r.start_time) === timeToMinutes(current.booking.start_time)
      && timeToMinutes(r.end_time) === timeToMinutes(current.booking.end_time);
    const ownIndex = taken.findIndex(own);
    if (ownIndex >= 0) taken.splice(ownIndex, 1);
    current.taken = takenIntervalsFrom(taken);
    current.openSet = openSetFrom(shifts);
    if (current.dayIso && !startsFor(current.dayIso).includes(SLOT_TIMES.indexOf(current.time))) current.time = null;
    $('resched-loading').style.display = 'none';
    $('resched-picker').style.display = '';
    renderDays();
    renderTimes();
    renderSelected();
  }

  return {
    // asOps: the ops screen moving a booking for the customer — no fee/plan rules.
    // reshootClaimId: pick the date of the free reshoot of an approved
    // マッチング数保証 claim (a new ¥0 booking with the same photographer/plan).
    async open(booking, onDone, { asOps = false, reshootClaimId = null } = {}) {
      const quote = asOps || reshootClaimId ? { allowed: true, usesPlan: false } : rescheduleQuote(booking);
      asOpsMode = !!asOps;
      current = { booking, quote, asOps, reshootClaimId, days: buildBookingDays(TOTAL_BOOKING_DAYS), taken: {}, openSet: new Set(), dayIso: null, time: null, onDone };
      $('resched-title').textContent = tr(reshootClaimId ? 'resched.titleReshoot' : 'resched.title');
      $('resched-save').textContent = tr(reshootClaimId ? 'resched.saveReshoot' : 'resched.save');
      $('resched-close').setAttribute('aria-label', tr('resched.close'));
      $('resched-loading').textContent = tr('resched.loading');
      $('resched-pick-date').textContent = tr('resched.pickDate');
      $('resched-pick-time').textContent = tr('resched.pickTime');
      $('resched-booking-label').textContent = reshootClaimId
        ? tr('resched.labelReshoot', { name: booking.photographer_name, date: booking.booking_date, plan: asOpsMode ? booking.plan_name : planNameText(booking.plan_name) })
        : tr('resched.labelCurrent', { name: booking.photographer_name, date: booking.booking_date, start: booking.start_time.slice(0, 5), end: booking.end_time.slice(0, 5) });
      $('resched-rule').textContent = tr(reshootClaimId ? 'resched.rule.reshoot'
        : asOps ? 'resched.rule.ops'
        : quote.usesPlan ? 'resched.rule.plan'
        : 'resched.rule.free');
      $('resched-loading').style.display = '';
      $('resched-picker').style.display = 'none';
      showError('');
      $('resched-selected').textContent = '';
      overlay.classList.add('is-open');
      try {
        await load();
      } catch (err) {
        $('resched-loading').style.display = 'none';
        showError(tr('resched.loadFailed'));
        console.error(err);
      }
    },
  };
}
