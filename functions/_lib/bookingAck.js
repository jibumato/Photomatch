// Records the photographer's 「確認しました」 for a booking (from the emailed
// link, admin.html, or the LINE button). Only if it's still the same request
// (not rescheduled since) and not confirmed yet; returns the updated row or null.
import { RESCHEDULABLE_STATUSES } from '../../js/data.js';
import { restUpdate } from './supabaseAdmin.js';

export async function markAcked(env, booking) {
  const match = { id: `eq.${booking.id}`, photographer_ack_at: 'is.null', status: `in.(${RESCHEDULABLE_STATUSES.join(',')})` };
  // Bookings made before the 確認 feature have no request time.
  if (booking.ack_requested_at) match.ack_requested_at = `eq.${booking.ack_requested_at}`;
  const updated = await restUpdate(env, 'bookings', match, { photographer_ack_at: new Date().toISOString() });
  return updated[0] || null;
}
