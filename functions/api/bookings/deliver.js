// POST /api/bookings/deliver  { booking_id, delivery_url }
// The photographer (or ops) records that the photos were delivered, with the
// album link. The customer gets the link by email and on マイページ. Sending it
// again with a new link updates it (and tells the customer). Payouts are only
// confirmed for delivered bookings (functions/api/payouts/release.js).
import { isValidDeliveryUrl, deliveryDueDate } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { sendEmail } from '../../_lib/email.js';
import { notifyOps } from '../../_lib/notifications.js';

const DELIVERABLE = ['paid', 'confirmed', 'requested', 'completed'];

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
  const url = String((payload && payload.delivery_url) || '').trim();
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);
  if (!isValidDeliveryUrl(url)) return jsonResponse({ error: '納品リンクは「https://」から始まるURLを入力してください。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  const [photographer] = await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'id,name,profile_id' });
  const isOwner = photographer && photographer.profile_id === user.id;
  if (!isOwner) {
    const profile = await getProfile(env, user.id);
    if (!profile || profile.role !== 'ops') return jsonResponse({ error: '予約が見つかりません。' }, 404);
  }
  if (!DELIVERABLE.includes(booking.status)) return jsonResponse({ error: 'この予約は納品できません（キャンセル済みなど）。' }, 409);
  const start = new Date(`${booking.booking_date}T${booking.start_time.slice(0, 5)}:00+09:00`);
  if (new Date() < start) return jsonResponse({ error: '撮影の開始前は、納品済みにできません。' }, 409);

  const first = !booking.delivered_at;
  await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, {
    delivery_url: url,
    ...(first ? { delivered_at: new Date().toISOString() } : {}),
  });

  const origin = new URL(request.url).origin;
  const [customer] = await restSelect(env, 'profiles', { id: `eq.${booking.client_id}`, select: 'email' });
  if (customer && customer.email) {
    try {
      await sendEmail(env, {
        to: customer.email,
        subject: first ? '【PhotoMatch】撮影データをお届けします' : '【PhotoMatch】撮影データのリンクを更新しました',
        text: `${booking.customer_name || 'お客'} 様\n\n${first ? 'PhotoMatchをご利用いただき、ありがとうございました。\n撮影データの準備ができましたので、下記のリンクからご覧ください。' : '撮影データのリンクが新しくなりました。下記のリンクからご覧ください。'}\n\n■撮影データ（Googleフォトのアルバム）\n${url}\n\n撮影日：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\nカメラマン：${(photographer && photographer.name) || '-'}\n\nリンクはマイページからもご確認いただけます。データの保存期間は撮影月の翌々月末日までです。お早めに保存してください。\n${origin}/mypage.html\n\n撮影の感想を、マイページの「レビューを書く」からお寄せいただけると励みになります。\n\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：info.photomatch@gmail.com`,
      });
    } catch (err) {
      console.error('deliver: customer email failed', err);
    }
  }
  if (first) {
    const due = deliveryDueDate(booking);
    const late = new Date().toISOString().slice(0, 10) > due.date;
    await notifyOps(env, `納品がありました${late ? '（期限超過）' : ''}`, `予約ID：${booking.id}\n撮影日：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\nカメラマン：${(photographer && photographer.name) || '-'}\n依頼者：${booking.customer_name || '-'}\n納品期限：${due.date}${due.speed ? '（スピード納品）' : ''}\nリンク：${url}`, origin);
  }
  return jsonResponse({ ok: true, first });
}
