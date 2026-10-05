// 日程変更のモーダル（マイページ）。同じカメラマン・同じプランで、日時だけを動かす。
// 選べるのは、カメラマンが受け付けている空き枠（予約画面と同じ判定: js/availability.js）。
// ルール（無料の範囲・あんしん振替プランの1回）の判定とサーバーでの確認は、
// js/data.js の rescheduleQuote と /api/bookings/reschedule。
import { getTakenSlots, getOpenShifts, rescheduleBooking, createReshoot } from './repo.js';
import { SLOT_TIMES, TOTAL_BOOKING_DAYS, buildBookingDays, addMinutes, rescheduleQuote } from './data.js';
import { takenIntervalsFrom, openSetFrom, canStartAt, timeToMinutes } from './availability.js';
import { escapeHtml } from './util.js';

export function mountRescheduleModal(container) {
  container.innerHTML = `
  <div class="pm-modal-overlay" id="resched-overlay">
    <div class="pm-modal-backdrop" id="resched-backdrop"></div>
    <div class="pm-modal-sheet pm-sheet-modal" style="height:auto;max-height:92vh" role="dialog" aria-modal="true" aria-labelledby="resched-title">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="resched-title" style="font:700 16px var(--pm-font-body);color:oklch(0.24 0.02 245)">日程を変更する</div>
          <div id="resched-booking-label" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="resched-close" aria-label="閉じる">×</button>
      </div>
      <div class="pm-sheet-body">
        <p id="resched-rule" style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 14px;padding:12px 14px;background:oklch(0.97 0.015 210);border-radius:12px"></p>
        <div id="resched-loading" class="pm-loading">空き枠を読み込み中…</div>
        <div id="resched-picker" style="display:none">
          <div style="font:700 13px var(--pm-font-body);margin-bottom:8px">日付を選ぶ</div>
          <div id="resched-days" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px"></div>
          <div style="font:700 13px var(--pm-font-body);margin-bottom:8px">開始時刻を選ぶ</div>
          <div id="resched-times" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        </div>
        <div class="pm-error-text" id="resched-error" style="display:none;margin-top:10px"></div>
      </div>
      <div class="pm-sheet-foot">
        <div id="resched-selected" style="flex:1;align-self:center;font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 235)"></div>
        <button class="pm-btn" id="resched-save" disabled style="background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:13px 22px;font:700 14px var(--pm-font-body);color:#fff;opacity:0.5">この日時に変更する</button>
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
      showError('現在、変更できる空き枠がありません。カメラマンが受付を開けるまでお待ちください。');
      return;
    }
    $('resched-days').innerHTML = withSlots.map((d) => {
      const active = d.iso === current.dayIso;
      return `<button type="button" data-iso="${d.iso}" class="resched-day pm-unbutton" aria-pressed="${active}" style="flex:0 0 auto;cursor:pointer;min-width:58px;text-align:center;padding:8px 6px;border-radius:12px;border:${active ? '2px solid oklch(0.62 0.14 210)' : '1px solid var(--pm-border)'};background:${active ? 'var(--pm-bg-mint)' : '#fff'}">
        <div style="font:700 12px var(--pm-font-body);color:${d.labelColor}">${d.label}</div>
        <div style="font:700 14px var(--pm-font-num)">${d.dateLabel}</div>
      </button>`;
    }).join('');
    $('resched-days').querySelectorAll('.resched-day').forEach((b) => b.addEventListener('click', () => {
      current.dayIso = b.dataset.iso; current.time = null; renderDays(); renderTimes(); renderSelected();
    }));
  }

  function renderTimes() {
    if (!current.dayIso) { $('resched-times').innerHTML = '<div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">先に日付を選んでください。</div>'; return; }
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
    $('resched-selected').textContent = ready ? `${day.dateLabel}（${day.label}） ${current.time}〜${addMinutes(current.time, current.booking.duration_min)}` : '';
    const btn = $('resched-save');
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '0.5';
  }

  $('resched-save').addEventListener('click', async () => {
    if (!current || !current.dayIso || !current.time) return;
    const day = current.days.find((d) => d.iso === current.dayIso);
    const planNote = current.quote.usesPlan ? '\n\n「あんしん振替プラン」の無料の日程変更（1回）を使います。' : '';
    const reshoot = current.reshootClaimId;
    if (reshoot && !confirm(`次の日時で無料再撮影を予約します（お支払いは不要です）。\n\n${day.dateLabel}（${day.label}） ${current.time}〜${addMinutes(current.time, current.booking.duration_min)}\n\nよろしいですか？`)) return;
    if (!reshoot && !confirm(`日程を次のとおり変更します。\n\n${day.dateLabel}（${day.label}） ${current.time}〜${addMinutes(current.time, current.booking.duration_min)}${planNote}\n\nよろしいですか？`)) return;
    const btn = $('resched-save');
    btn.disabled = true;
    showError('');
    try {
      if (reshoot) await createReshoot(reshoot, current.dayIso, current.time);
      else await rescheduleBooking(current.booking.id, current.dayIso, current.time);
      const done = current.onDone;
      const asOps = current.asOps;
      close();
      alert(reshoot ? '無料再撮影を予約しました。予約内容をメールでお送りしました。' : asOps ? '日程を変更しました。お客様・カメラマンにメールで知らせました。' : '日程を変更しました。変更内容をメールでお送りしました。');
      if (done) done();
    } catch (err) {
      showError(err.message || '日程変更に失敗しました。時間をおいて再度お試しください。');
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
      current = { booking, quote, asOps, reshootClaimId, days: buildBookingDays(TOTAL_BOOKING_DAYS), taken: {}, openSet: new Set(), dayIso: null, time: null, onDone };
      $('resched-title').textContent = reshootClaimId ? '無料再撮影の日程を選ぶ' : '日程を変更する';
      $('resched-save').textContent = reshootClaimId ? 'この日時で予約する' : 'この日時に変更する';
      $('resched-booking-label').textContent = reshootClaimId
        ? `${booking.photographer_name} ・ 元の撮影：${booking.booking_date}（${booking.plan_name}）`
        : `${booking.photographer_name} ・ 現在：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜${booking.end_time.slice(0, 5)}`;
      $('resched-rule').textContent = reshootClaimId
        ? 'マッチング数保証による無料再撮影です。同じカメラマン・同じプランで、お支払いは不要です。カメラマンが受け付けている空き枠から選んでください。'
        : asOps
        ? '運営として日程を変更します（料金・回数の制限はかかりません）。変更先は、カメラマンが受付中にしている空き枠から選べます。'
        : quote.usesPlan
        ? '撮影日の2日前からの日程変更です。「あんしん振替プラン」の無料の日程変更（1回）を使います。'
        : '撮影日の3日前までの日程変更は無料です（回数の制限はありません）。';
      $('resched-loading').style.display = '';
      $('resched-picker').style.display = 'none';
      showError('');
      $('resched-selected').textContent = '';
      overlay.classList.add('is-open');
      try {
        await load();
      } catch (err) {
        $('resched-loading').style.display = 'none';
        showError('空き枠を取得できませんでした。時間をおいて再度お試しください。');
        console.error(err);
      }
    },
  };
}
