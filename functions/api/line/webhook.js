// POST /api/line/webhook — set as the Webhook URL of the PhotoMatch LINE
// account's Messaging API channel. Handles:
//   - a photographer sending their link code (PM-XXXXXX, from admin.html)
//     -> links that LINE to their account
//   - the 「確認しました」 button on a booking notification (postback)
//   - unfollow (blocked the account) -> stops sending to them
// Other messages are left alone (ops can answer them from LINE Official
// Account Manager). Always answers 200 so LINE doesn't retry; a bad
// signature gets 401.
import { restSelect, restUpsert, restUpdate } from '../../_lib/supabaseAdmin.js';
import { isLineConfigured, verifyLineSignature, lineReply } from '../../_lib/line.js';
import { markAcked } from '../../_lib/bookingAck.js';
import { RESCHEDULABLE_STATUSES } from '../../../js/data.js';

const text = (t) => ({ type: 'text', text: t });

async function handleCode(env, event, code) {
  const [row] = await restSelect(env, 'line_link_codes', { code: `eq.${code}`, select: '*' });
  if (!row || new Date(row.expires_at) <= new Date()) {
    return lineReply(env, event.replyToken, [text('コードが見つからないか、有効期限（30分）が切れています。管理画面の「LINE通知」で、コードを発行し直してください。')]);
  }
  await restUpsert(env, 'line_links', {
    photographer_id: row.photographer_id, line_user_id: event.source.userId, active: true,
    linked_at: new Date().toISOString(), last_error: null, last_error_at: null,
  });
  // Single use.
  await restUpdate(env, 'line_link_codes', { photographer_id: `eq.${row.photographer_id}` }, { expires_at: new Date().toISOString() });
  return lineReply(env, event.replyToken, [text('PhotoMatchのLINE通知を設定しました。予約の確定・日程変更・キャンセルや、依頼者からのメッセージをこのLINEでお知らせします。')]);
}

async function handleAck(env, event, params) {
  const bookingId = params.get('ack');
  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  const links = await restSelect(env, 'line_links', { line_user_id: `eq.${event.source.userId}`, active: 'eq.true', select: 'photographer_id' });
  if (!booking || !links.some((l) => l.photographer_id === booking.photographer_id)) {
    return lineReply(env, event.replyToken, [text('この予約は確認できません。管理画面から確認してください。')]);
  }
  const when = `${booking.booking_date.slice(5).replace('-', '/')} ${String(booking.start_time).slice(0, 5)}〜`;
  // The button belongs to one 確認 request; after a reschedule it's stale.
  const requested = params.get('r');
  const current = booking.ack_requested_at ? String(new Date(booking.ack_requested_at).getTime()) : '';
  if (!RESCHEDULABLE_STATUSES.includes(booking.status)) return lineReply(env, event.replyToken, [text(`${when}の予約は、キャンセルなどで確認の必要がなくなりました。`)]);
  if (requested !== current) return lineReply(env, event.replyToken, [text('この通知のあとに日程が変更されています。最新の通知のボタンか、管理画面から確認してください。')]);
  if (booking.photographer_ack_at) return lineReply(env, event.replyToken, [text(`${when}の予約は確認済みです。`)]);
  const updated = await markAcked(env, booking);
  return lineReply(env, event.replyToken, [text(updated ? `${when}の予約を確認しました。当日はよろしくお願いします。` : '予約の状態が変わりました。管理画面から確認してください。')]);
}

async function handleEvent(env, event) {
  const userId = event.source && event.source.userId;
  if (!userId) return;
  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const m = event.message.text.toUpperCase().replace(/\s/g, '').match(/PM-?([A-Z0-9]{6})/);
    if (m) await handleCode(env, event, `PM-${m[1]}`);
  } else if (event.type === 'postback' && event.postback) {
    const params = new URLSearchParams(event.postback.data || '');
    if (params.get('ack')) await handleAck(env, event, params);
  } else if (event.type === 'unfollow') {
    await restUpdate(env, 'line_links', { line_user_id: `eq.${userId}` }, { active: false });
  }
}

export async function onRequestPost({ request, env }) {
  if (!isLineConfigured(env)) return new Response('LINE is not configured', { status: 503 });
  const raw = await request.text();
  if (!(await verifyLineSignature(env, raw, request.headers.get('X-Line-Signature')))) {
    return new Response('bad signature', { status: 401 });
  }
  let events = [];
  try {
    events = JSON.parse(raw).events || [];
  } catch (e) {
    return new Response('ok');
  }
  for (const event of events) {
    try {
      await handleEvent(env, event);
    } catch (err) {
      console.error('LINE webhook event failed', event.type, err);
    }
  }
  return new Response('ok');
}
