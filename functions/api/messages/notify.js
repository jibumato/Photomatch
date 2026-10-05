// POST /api/messages/notify  { booking_id }
// Called by the chat after a message is sent: emails the other party that a
// new message arrived (the chat itself is only seen while the page is open).
// At most one email per booking and recipient every 10 minutes, and only
// when the caller really did just send a message in that booking.
import { verifyUser, restSelect, restUpsert } from '../../_lib/supabaseAdmin.js';
import { sendEmail } from '../../_lib/email.js';

const THROTTLE_MS = 10 * 60 * 1000;

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
  const bookingId = payload && payload.booking_id;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: 'id,client_id,photographer_id,booking_date,start_time,customer_name' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  const [photographer] = await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'name,profile_id' });

  let senderRole;
  if (booking.client_id === user.id) senderRole = 'client';
  else if (photographer && photographer.profile_id === user.id) senderRole = 'pro';
  else return jsonResponse({ error: '予約が見つかりません。' }, 404);
  const recipientRole = senderRole === 'client' ? 'pro' : 'client';
  const recipientId = recipientRole === 'client' ? booking.client_id : photographer && photographer.profile_id;
  if (!recipientId) return jsonResponse({ ok: true, sent: false });

  // Only right after the caller's own message.
  const [latest] = await restSelect(env, 'messages', {
    booking_id: `eq.${bookingId}`, sender_id: `eq.${user.id}`, select: 'text,created_at', order: 'created_at.desc', limit: '1',
  });
  if (!latest || Date.now() - new Date(latest.created_at).getTime() > 2 * 60 * 1000) return jsonResponse({ ok: true, sent: false });

  const [last] = await restSelect(env, 'message_notifications', { booking_id: `eq.${bookingId}`, recipient_role: `eq.${recipientRole}`, select: 'last_sent_at' });
  if (last && Date.now() - new Date(last.last_sent_at).getTime() < THROTTLE_MS) return jsonResponse({ ok: true, sent: false });

  const [recipient] = await restSelect(env, 'profiles', { id: `eq.${recipientId}`, select: 'email' });
  if (!recipient || !recipient.email) return jsonResponse({ ok: true, sent: false });

  const origin = new URL(request.url).origin;
  const page = recipientRole === 'client' ? 'mypage.html' : 'admin.html';
  const from = senderRole === 'client' ? `依頼者（${booking.customer_name || 'お客様'}）` : `カメラマン（${(photographer && photographer.name) || ''}）`;
  const snippet = latest.text.length > 200 ? `${latest.text.slice(0, 200)}…` : latest.text;
  await restUpsert(env, 'message_notifications', { booking_id: bookingId, recipient_role: recipientRole, last_sent_at: new Date().toISOString() });
  try {
    await sendEmail(env, {
      to: recipient.email,
      subject: `【PhotoMatch】${from}からメッセージが届きました`,
      text: `${from}から、${booking.booking_date} ${booking.start_time.slice(0, 5)}〜の予約についてメッセージが届きました。\n\n――\n${snippet}\n――\n\n返信は、こちらからどうぞ。\n${origin}/${page}\n\n※このお知らせは、同じ予約について10分に1通までお送りします。\n\n――――――――――\nPhotoMatch\n${origin}/`,
    });
  } catch (err) {
    console.error('messages/notify failed', err);
    return jsonResponse({ ok: true, sent: false });
  }
  return jsonResponse({ ok: true, sent: true });
}
