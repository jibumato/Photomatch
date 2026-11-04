// GET /api/calendar/feed/<token>.ics
// A photographer's calendar URL (issued from admin.html, /api/calendar/link):
// Google Calendar's 「URLで追加」 or an iPhone subscribed calendar fetches it now
// and then, so new bookings, reschedules and cancellations show up without
// anyone importing a file. The token is the only key: it is random, can be
// re-issued (the old one then stops working), and the feed leaves out the
// customer's contact details.
import { restSelect, restUpdate } from '../../../_lib/supabaseAdmin.js';
import { feedIcs } from '../../../_lib/ics.js';
import { jstDateIso, addDaysToIso } from '../../../../js/data.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
// Past shoots stay on the calendar for a while (delivery is still due).
const PAST_DAYS = 60;
const SHOWN_STATUSES = ['paid', 'requested', 'confirmed', 'completed'];

const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env, params, waitUntil }) {
  const token = String(params.token || '').replace(/\.ics$/i, '');
  if (!TOKEN_RE.test(token)) return notFound();
  try {
    const [feed] = await restSelect(env, 'calendar_feeds', { token: `eq.${token}`, select: 'photographer_id' });
    if (!feed) return notFound();
    const [photographer] = await restSelect(env, 'photographers', { id: `eq.${feed.photographer_id}`, select: 'name' });
    const bookings = await restSelect(env, 'bookings', {
      photographer_id: `eq.${feed.photographer_id}`,
      status: `in.(${SHOWN_STATUSES.join(',')})`,
      booking_date: `gte.${addDaysToIso(jstDateIso(), -PAST_DAYS)}`,
      select: 'id,booking_date,start_time,end_time,area,plan_name,customer_name,order_number,rescheduled_count,status',
      order: 'booking_date.asc,start_time.asc',
      limit: '500',
    });
    const origin = new URL(request.url).origin;
    const body = feedIcs(bookings, { photographerName: photographer && photographer.name, origin });
    // So the photographer can see that their calendar app has picked it up.
    const touch = restUpdate(env, 'calendar_feeds', { photographer_id: `eq.${feed.photographer_id}` }, { last_fetched_at: new Date().toISOString() })
      .catch((err) => console.error('calendar feed: last_fetched_at failed', err));
    if (waitUntil) waitUntil(touch);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="photomatch.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (err) {
    console.error('calendar feed failed', err);
    return new Response('Temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '600' } });
  }
}
