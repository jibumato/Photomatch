// POST /api/bookings/staff-pick  { booking_id, note }
// ops-only. 「異性スタッフ写真セレクト」: after delivery, a staff member of the
// opposite gender to the customer picks the photo they'd recommend for dating
// apps; ops sends that pick (which photo + why) here. The customer is emailed
// and sees it on マイページ. Sending again updates it.
import { OPPOSITE_SEX_OPTION_KEY } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { sendEmail } from '../../_lib/email.js';

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
  const note = String((payload && payload.note) || '').trim();
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);
  if (!note || note.length > 1000) return jsonResponse({ error: 'おすすめの写真と理由を、1000文字以内で入力してください。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!(booking.options || []).some((o) => o.key === OPPOSITE_SEX_OPTION_KEY)) return jsonResponse({ error: 'この予約には「異性スタッフ写真セレクト」が付いていません。' }, 409);
  if (booking.status === 'canceled') return jsonResponse({ error: 'キャンセルされた予約です。' }, 409);
  if (!booking.delivered_at) return jsonResponse({ error: 'まだ納品されていません。カメラマンの納品後に送ってください。' }, 409);

  const first = !booking.staff_pick_at;
  await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, { staff_pick_note: note, staff_pick_at: new Date().toISOString() });

  const origin = new URL(request.url).origin;
  const [customer] = await restSelect(env, 'profiles', { id: `eq.${booking.client_id}`, select: 'email' });
  if (customer && customer.email) {
    try {
      await sendEmail(env, {
        to: customer.email,
        subject: first ? '【PhotoMatch】異性スタッフが選んだ「おすすめの一枚」をお届けします' : '【PhotoMatch】「おすすめの一枚」を更新しました',
        text: `${booking.customer_name || 'お客'} 様\n\nオプション「異性スタッフ写真セレクト」のご利用ありがとうございます。異性のスタッフの目線で、マッチングアプリで好印象につながりそうな一枚を選びました。\n\n■おすすめの一枚\n${note}\n\n■撮影データ\n${booking.delivery_url || '（マイページをご覧ください）'}\n\nマイページでもご確認いただけます。\n${origin}/mypage.html\n\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：info.photomatch@gmail.com`,
      });
    } catch (err) {
      console.error('staff-pick: email failed', err);
    }
  }
  return jsonResponse({ ok: true, first });
}
