// The photographer's 「予約を確認しました」.
//
//   GET  /api/bookings/ack?id=…&t=…   page opened from the booking email
//                                      (signed link, no login needed)
//   POST /api/bookings/ack            form post from that page (id, t), or
//                                      JSON { booking_id } from admin.html
//                                      (logged-in photographer)
//
// The GET only shows a page with a button: mail scanners open links in
// emails, and opening the link must not count as the photographer's
// confirmation. If nobody confirms within PHOTOGRAPHER_ACK_HOURS, ops is
// alerted (/api/bookings/ack-check).
import { RESCHEDULABLE_STATUSES } from '../../../js/data.js';
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { verifyAckToken } from '../../_lib/ackToken.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, body, status = 200) {
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | PhotoMatch</title>
<style>body{margin:0;background:#f4fbfc;font:15px/1.8 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2f3a}main{max-width:480px;margin:48px auto;padding:0 16px}.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 6px 20px rgba(20,70,90,.08)}h1{font-size:19px;margin:0 0 12px}dl{margin:12px 0 20px;font-size:14px}dt{color:#5b6b75;font-size:12px}dd{margin:0 0 8px}button{width:100%;border:0;border-radius:100px;padding:14px;font-family:inherit;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(135deg,#1cc8d8,#2a8fd8);cursor:pointer}a{color:#1b78a8}</style></head>
<body><main><div class="card">${body}</div><p style="font-size:13px;text-align:center;margin-top:16px"><a href="/admin.html">管理画面を開く</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const invalid = () => page('リンクが無効です', '<h1>このリンクは使えません</h1><p>日程変更などで新しいメールが届いている場合は、そちらのリンクを開いてください。管理画面の予約一覧からも確認できます。</p>', 400);

function stateMessage(booking) {
  if (!RESCHEDULABLE_STATUSES.includes(booking.status)) return page('確認は不要です', '<h1>この予約は確認の必要がありません</h1><p>キャンセルなどで、すでに有効な予約ではありません。</p>');
  if (booking.photographer_ack_at) return page('確認済みです', '<h1>確認済みです</h1><p>この予約は、すでに確認されています。ありがとうございます。</p>');
  return null;
}

async function loadSigned(env, id, token) {
  if (!id || !token) return null;
  const [booking] = await restSelect(env, 'bookings', { id: `eq.${id}`, select: '*' });
  if (!booking || !(await verifyAckToken(env, booking.id, booking.ack_requested_at, token))) return null;
  return booking;
}

// Marks the booking confirmed, only if it's still the same request (not
// rescheduled since) and not confirmed yet.
async function markAcked(env, booking) {
  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${booking.id}`, ack_requested_at: `eq.${booking.ack_requested_at}`, photographer_ack_at: 'is.null', status: `in.(${RESCHEDULABLE_STATUSES.join(',')})` },
    { photographer_ack_at: new Date().toISOString() },
  );
  return updated[0] || null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('t');
  const booking = await loadSigned(env, id, token);
  if (!booking) return invalid();
  const done = stateMessage(booking);
  if (done) return done;
  return page('予約の確認', `<h1>予約の確認</h1><p>内容を確認して、「確認しました」を押してください。</p>
<dl><dt>日時</dt><dd>${esc(booking.booking_date)} ${esc(String(booking.start_time).slice(0, 5))}〜${esc(String(booking.end_time || '').slice(0, 5))}</dd>
<dt>依頼者</dt><dd>${esc(booking.customer_name)} 様</dd><dt>プラン</dt><dd>${esc(booking.plan_name)}</dd><dt>撮影エリア</dt><dd>${esc(booking.area || '-')}</dd></dl>
<form method="post" action="/api/bookings/ack"><input type="hidden" name="id" value="${esc(booking.id)}"><input type="hidden" name="t" value="${esc(token)}"><button type="submit">確認しました</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) {
    // Form post from the emailed link's page.
    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return invalid();
    }
    const booking = await loadSigned(env, form.get('id'), form.get('t'));
    if (!booking) return invalid();
    const done = stateMessage(booking);
    if (done) return done;
    const updated = await markAcked(env, booking);
    if (!updated) return stateMessage((await restSelect(env, 'bookings', { id: `eq.${booking.id}`, select: '*' }))[0] || booking) || invalid();
    return page('確認しました', '<h1>確認しました</h1><p>ありがとうございます。当日はよろしくお願いします。依頼者とのメッセージや予約の詳細は、管理画面から確認できます。</p>');
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const bookingId = payload && payload.booking_id;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  const [photographer] = booking
    ? await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'profile_id' })
    : [];
  if (!booking || !photographer || photographer.profile_id !== user.id) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!RESCHEDULABLE_STATUSES.includes(booking.status)) return jsonResponse({ error: 'この予約は確認の必要がありません（キャンセル済みなど）。' }, 409);
  if (booking.photographer_ack_at) return jsonResponse({ ok: true, photographer_ack_at: booking.photographer_ack_at });
  // Bookings made before this feature have no request time; confirming them
  // is still fine (and harmless).
  const updated = booking.ack_requested_at
    ? await markAcked(env, booking)
    : (await restUpdate(env, 'bookings', { id: `eq.${booking.id}`, photographer_ack_at: 'is.null' }, { photographer_ack_at: new Date().toISOString() }))[0];
  if (!updated) return jsonResponse({ error: '予約の状態が変わりました。画面を読み込み直してください。' }, 409);
  return jsonResponse({ ok: true, photographer_ack_at: updated.photographer_ack_at });
}
