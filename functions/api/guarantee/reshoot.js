// POST /api/guarantee/reshoot  { claim_id, booking_date, start_time }
// The customer of an APPROVED マッチング数保証 claim books the free reshoot:
// same photographer, same plan, no options, ¥0, no payment. The slot goes
// through the same checks as any booking. One reshoot per claim (a canceled
// one can be booked again).
import { verifyUser, restSelect, restInsert, restUpdate } from '../../_lib/supabaseAdmin.js';
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
  const { claim_id: claimId, booking_date: date, start_time: start } = payload || {};
  if (!claimId || !date || !start) return jsonResponse({ error: '再撮影の日時を選んでください。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const [claim] = await restSelect(env, 'guarantee_claims', { id: `eq.${claimId}`, select: '*' });
  if (!claim || claim.client_id !== user.id) return jsonResponse({ error: '申請が見つかりません。' }, 404);
  if (claim.status !== 'approved') return jsonResponse({ error: '承認された申請だけ、再撮影を予約できます。' }, 409);
  if (claim.reshoot_booking_id) {
    const [existing] = await restSelect(env, 'bookings', { id: `eq.${claim.reshoot_booking_id}`, select: 'status' });
    if (existing && existing.status !== 'canceled') return jsonResponse({ error: '再撮影はすでに予約済みです。日時の変更はマイページの「日程変更」からどうぞ。' }, 409);
  }

  const [original] = await restSelect(env, 'bookings', { id: `eq.${claim.booking_id}`, select: '*' });
  if (!original) return jsonResponse({ error: '元の予約が見つかりません。' }, 404);
  const [photographer] = await restSelect(env, 'photographers', { id: `eq.${original.photographer_id}`, select: 'id,is_visible,is_paused' });
  if (!photographer || photographer.is_visible === false || photographer.is_paused === true) {
    return jsonResponse({ error: '現在、このカメラマンは受付を休止しています。お問い合わせください。' }, 409);
  }

  const windowError = bookingWindowError(date);
  if (windowError) return jsonResponse({ error: windowError }, 400);
  const durationMin = original.duration_min || 45;
  const slot = await checkSlot(env, { photographerId: original.photographer_id, bookingDate: date, startTime: start, durationMin });
  if (slot.error) return jsonResponse({ error: slot.error }, 409);

  const booking = await restInsert(env, 'bookings', {
    client_id: user.id,
    photographer_id: original.photographer_id,
    plan_name: original.plan_name,
    plan_price: 0,
    plan_description: original.plan_description || null,
    duration_min: durationMin,
    area: original.area,
    booking_date: date,
    start_time: start,
    end_time: slot.endTime,
    customer_name: original.customer_name,
    customer_contact: original.customer_contact,
    customer_gender: original.customer_gender || null,
    options: [],
    options_total: 0,
    total_price: 0,
    status: 'paid',
    reshoot_of: original.id,
  });
  await restUpdate(env, 'guarantee_claims', { id: `eq.${claimId}` }, { reshoot_booking_id: booking.id });
  await notifyBooking(env, booking.id, 'confirmed', new URL(request.url).origin);
  return jsonResponse({ ok: true, booking_id: booking.id });
}
