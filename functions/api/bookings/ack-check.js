// GET|POST /api/bookings/ack-check
// Run every 10 minutes by Supabase (pg_cron, see supabase/schema.sql). Finds
// bookings whose photographer hasn't pressed 「確認しました」 within
// PHOTOGRAPHER_ACK_HOURS and alerts ops once per request (ack_alerted_at),
// also reminding the photographer.
//
// Safe to call by anyone: it only sends the alerts that are due, each once,
// and returns counts. If CRON_SECRET is set, callers must send it in the
// X-Cron-Secret header.
import { PHOTOGRAPHER_ACK_HOURS, RESCHEDULABLE_STATUSES } from '../../../js/data.js';
import { restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { notifyAckOverdue } from '../../_lib/notifications.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

async function run({ request, env }) {
  if (env.CRON_SECRET && request.headers.get('X-Cron-Secret') !== env.CRON_SECRET) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }
  const cutoff = new Date(Date.now() - PHOTOGRAPHER_ACK_HOURS * 3600e3).toISOString();
  const due = await restSelect(env, 'bookings', {
    select: '*',
    status: `in.(${RESCHEDULABLE_STATUSES.join(',')})`,
    photographer_ack_at: 'is.null',
    ack_alerted_at: 'is.null',
    ack_requested_at: `lt.${cutoff}`,
    order: 'ack_requested_at.asc',
    limit: '50',
  });
  const origin = new URL(request.url).origin;
  let alerted = 0;
  for (const booking of due) {
    // A shoot that has already started doesn't need a 確認 any more.
    if (new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+09:00`) <= new Date()) continue;
    // Claim it first so two overlapping runs can't both send the alert.
    const now = new Date().toISOString();
    const claimed = await restUpdate(env, 'bookings', { id: `eq.${booking.id}`, ack_alerted_at: 'is.null', photographer_ack_at: 'is.null' }, { ack_alerted_at: now });
    if (!claimed.length) continue;
    if (await notifyAckOverdue(env, booking, origin)) {
      alerted += 1;
    } else {
      // The ops email failed: release the claim so the next run tries again.
      await restUpdate(env, 'bookings', { id: `eq.${booking.id}`, ack_alerted_at: `eq.${now}` }, { ack_alerted_at: null });
    }
  }
  return jsonResponse({ ok: true, due: due.length, alerted });
}

export const onRequestGet = run;
export const onRequestPost = run;
