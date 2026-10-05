// Server-side "can this booking go in this slot?" check, shared by checkout
// and rescheduling. The browser shows the same availability (js/availability.js),
// but this is the authoritative check — it runs again right before money moves.
import {
  SLOT_TIMES, BOOKING_LEAD_DAYS, TOTAL_BOOKING_DAYS, PENDING_PAYMENT_HOLD_MIN, addMinutes, jstDateIso, addDaysToIso,
} from '../../js/data.js';
import { restSelect } from './supabaseAdmin.js';
import { timeToMinutes, slotCountFor, openSetFrom, isSlotOffered } from '../../js/availability.js';

// null when the date is inside the bookable window (counted in Japan time).
export function bookingWindowError(bookingDate) {
  const todayIso = jstDateIso();
  const minIso = addDaysToIso(todayIso, BOOKING_LEAD_DAYS);
  const maxIso = addDaysToIso(todayIso, BOOKING_LEAD_DAYS + TOTAL_BOOKING_DAYS);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate)) || bookingDate < minIso || bookingDate >= maxIso) {
    return 'ご指定の日付は予約可能な期間外です。';
  }
  return null;
}

// Returns { error } (a message for the customer) or { endTime } when the slot
// is free. excludeBookingId lets a booking move to a slot overlapping its own
// current time.
export async function checkSlot(env, { photographerId, bookingDate, startTime, durationMin, excludeBookingId }) {
  if (!SLOT_TIMES.includes(startTime)) return { error: '時間帯が不正です。' };
  const startIndex = SLOT_TIMES.indexOf(startTime);
  const slotCount = slotCountFor(durationMin);
  if (startIndex + slotCount > SLOT_TIMES.length) return { error: 'この時間帯には予約できません。' };
  const endTime = addMinutes(startTime, durationMin);

  const [existingBookings, shifts] = await Promise.all([
    restSelect(env, 'bookings', {
      photographer_id: `eq.${photographerId}`,
      booking_date: `eq.${bookingDate}`,
      status: 'neq.canceled',
      select: 'id,start_time,end_time,status,created_at',
    }),
    restSelect(env, 'shifts', {
      photographer_id: `eq.${photographerId}`,
      shift_date: `eq.${bookingDate}`,
      is_open: 'eq.true',
      select: 'shift_date,start_time,is_open',
    }),
  ]);

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const staleCutoff = Date.now() - PENDING_PAYMENT_HOLD_MIN * 60 * 1000;
  const isTaken = existingBookings.some((b) => {
    if (b.id === excludeBookingId) return false;
    if (b.status === 'pending_payment' && new Date(b.created_at).getTime() < staleCutoff) return false;
    return startMin < timeToMinutes(b.end_time) && endMin > timeToMinutes(b.start_time);
  });
  // Every 30-minute slot the plan spans must have been opened by the photographer.
  const openSet = openSetFrom(shifts);
  const notOffered = SLOT_TIMES.slice(startIndex, startIndex + slotCount).some((t) => !isSlotOffered(openSet, bookingDate, t));
  if (isTaken || notOffered) return { error: 'この枠は予約できません（すでに埋まっているか、カメラマンが受け付けていない時間です）。別の日時をお選びください。' };
  return { endTime };
}
