// POST /api/bookings/reschedule  { booking_id, booking_date, start_time }
// A customer moves their booking to another date/time with the same
// photographer and plan. The rules are rescheduleQuote() in js/data.js:
// free until 3 days before; from 2 days before, only with the あんしん振替プラン
// option (its one free change). The new slot goes through the same checks as a
// new booking (opened by the photographer, not taken, inside the booking window).
import { rescheduleQuote, RESCHEDULE_DENIED_MESSAGE } from '../../../js/data.js';
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { bookingWindowError, checkSlot } from '../../_lib/slots.js';
import { notifyBooking } from '../../_lib/notifications.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const { booking_id: bookingId, booking_date: newDate, start_time: newStart } = payload || {};
  if (!bookingId || !newDate || !newStart) return jsonResponse({ error: '変更先の日時を選んでください。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  // Same response for "doesn't exist" and "not yours", so ids can't be probed.
  if (!booking || booking.client_id !== user.id) return jsonResponse({ error: '予約が見つかりません。' }, 404);

  const quote = rescheduleQuote(booking);
  if (!quote.allowed) return jsonResponse({ error: RESCHEDULE_DENIED_MESSAGE[quote.reason] || 'このご予約は日程変更できません。' }, 409);

  if (newDate === booking.booking_date && newStart === booking.start_time.slice(0, 5)) {
    return jsonResponse({ error: '現在のご予約と同じ日時です。別の日時をお選びください。' }, 400);
  }

  const [photographer] = await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'id,is_visible,is_paused' });
  if (!photographer || photographer.is_visible === false || photographer.is_paused === true) {
    return jsonResponse({ error: '現在、このカメラマンは新しい日時の受付を休止しています。お問い合わせください。' }, 409);
  }

  const windowError = bookingWindowError(newDate);
  if (windowError) return jsonResponse({ error: windowError }, 400);

  const slot = await checkSlot(env, {
    photographerId: booking.photographer_id,
    bookingDate: newDate,
    startTime: newStart,
    durationMin: booking.duration_min || 30,
    excludeBookingId: booking.id,
  });
  if (slot.error) return jsonResponse({ error: slot.error }, 409);

  // Conditional on the booking still being where we read it, so two quick
  // requests (or a cancel at the same moment) can't both go through.
  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${booking.id}`, client_id: `eq.${user.id}`, status: `eq.${booking.status}`, booking_date: `eq.${booking.booking_date}`, start_time: `eq.${booking.start_time}` },
    {
      booking_date: newDate,
      start_time: newStart,
      end_time: slot.endTime,
      previous_booking_date: booking.booking_date,
      previous_start_time: booking.start_time,
      rescheduled_at: new Date().toISOString(),
      rescheduled_count: (booking.rescheduled_count || 0) + 1,
      reschedule_plan_used: booking.reschedule_plan_used || quote.usesPlan,
    },
  );
  if (!updated.length) return jsonResponse({ error: 'ご予約の状態が変わったため、日程変更できませんでした。画面を読み込み直してください。' }, 409);

  await notifyBooking(env, booking.id, 'rescheduled', new URL(request.url).origin);
  return jsonResponse({ ok: true, booking_date: newDate, start_time: newStart, end_time: slot.endTime, used_plan: quote.usesPlan });
}
