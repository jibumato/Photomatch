// Which start times a photographer can be booked for. One implementation, used
// by the booking grid, the reschedule screen (browser) and the checkout /
// reschedule Functions (server), so they can't disagree.
//
// A 30-minute slot is OFFERED only when the photographer has opened it (a
// `shifts` row with is_open = true) — everything is closed by default. A slot
// is TAKEN when a booking's [start, end) covers it. A booking can start at a
// slot when it and every following slot the plan needs are offered and free.
import { SLOT_TIMES } from './data.js';

export const timeToMinutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

// booking_slots / bookings rows -> { 'YYYY-MM-DD': [[startMin, endMin], ...] }
export function takenIntervalsFrom(rows) {
  const out = {};
  rows.forEach((row) => {
    (out[row.booking_date] = out[row.booking_date] || []).push([timeToMinutes(row.start_time), timeToMinutes(row.end_time)]);
  });
  return out;
}

// shifts rows -> Set of 'YYYY-MM-DD|HH:MM' the photographer has opened.
export function openSetFrom(rows) {
  return new Set(rows.filter((r) => r.is_open).map((r) => `${r.shift_date}|${String(r.start_time).slice(0, 5)}`));
}

export const slotCountFor = (durationMin) => Math.max(1, Math.ceil((durationMin || 30) / 30));

export function isSlotTaken(takenIntervals, iso, time) {
  const mins = timeToMinutes(time);
  return (takenIntervals[iso] || []).some(([s, e]) => mins >= s && mins < e);
}

export function isSlotOffered(openSet, iso, time) {
  return openSet.has(`${iso}|${time}`);
}

// 'booked' | 'closed' | 'open' for one 30-minute cell (what the shift grid shows).
export function cellState(takenIntervals, openSet, iso, time) {
  if (isSlotTaken(takenIntervals, iso, time)) return 'booked';
  return isSlotOffered(openSet, iso, time) ? 'open' : 'closed';
}

// Can a booking of durationMin start at SLOT_TIMES[slotIndex] on iso?
export function canStartAt(takenIntervals, openSet, iso, slotIndex, durationMin) {
  const count = slotCountFor(durationMin);
  if (slotIndex < 0 || slotIndex + count > SLOT_TIMES.length) return false;
  for (let i = 0; i < count; i++) {
    const time = SLOT_TIMES[slotIndex + i];
    if (!isSlotOffered(openSet, iso, time) || isSlotTaken(takenIntervals, iso, time)) return false;
  }
  return true;
}
