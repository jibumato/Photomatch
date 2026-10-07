// POST /api/guarantee/review  { claim_id, status: 'approved' | 'rejected', note }
// ops-only. Decides a マッチング数保証 claim and emails the result: the customer
// (approved → pick the free reshoot date on マイページ; rejected → the reason),
// and on approval the photographer too (a free reshoot is coming).
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { sendEmail } from '../../_lib/email.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const FOOTER = (origin) => `\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：info.photomatch@gmail.com`;

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const claimId = payload && payload.claim_id;
  const status = payload && payload.status;
  const note = String((payload && payload.note) || '').trim().slice(0, 500) || null;
  if (!claimId) return jsonResponse({ error: 'claim_idが必要です。' }, 400);
  if (!['approved', 'rejected'].includes(status)) return jsonResponse({ error: '審査結果が不正です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const updated = await restUpdate(env, 'guarantee_claims', { id: `eq.${claimId}`, status: 'eq.claimed' }, {
    status, review_note: note, reviewed_at: new Date().toISOString(), reviewed_by: user.id,
  });
  if (!updated.length) return jsonResponse({ error: 'この申請は審査待ちではありません（審査済みなど）。' }, 409);
  const claim = updated[0];

  const origin = new URL(request.url).origin;
  try {
    const [booking] = await restSelect(env, 'bookings', { id: `eq.${claim.booking_id}`, select: '*' });
    const [customer] = await restSelect(env, 'profiles', { id: `eq.${claim.client_id}`, select: 'email' });
    const [photographer] = booking ? await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'name,profile_id' }) : [];
    const shoot = booking ? `${booking.order_number ? `注文番号：${booking.order_number}\n` : ''}${booking.booking_date} ${booking.start_time.slice(0, 5)}〜（${booking.plan_name}）` : '-';
    const noteBlock = note ? `\n\n運営より：\n${note}` : '';
    if (customer && customer.email) {
      await sendEmail(env, status === 'approved'
        ? { to: customer.email, subject: '【PhotoMatch】マッチング数保証：無料再撮影を承認しました', text: `${(booking && booking.customer_name) || 'お客'} 様\n\nマッチング数保証の申請を承認しました。同じカメラマン・同じプランで、無料で再撮影いたします。${noteBlock}\n\n■対象の撮影\n${shoot}\n\nマイページの「再撮影の日程を選ぶ」から、ご都合のよい日時をお選びください（お支払いは不要です）。\n${origin}/mypage.html\n${FOOTER(origin)}` }
        : { to: customer.email, subject: '【PhotoMatch】マッチング数保証の審査結果のお知らせ', text: `${(booking && booking.customer_name) || 'お客'} 様\n\nマッチング数保証の申請について審査いたしましたが、誠に恐れ入りますが、今回は対象外となりました。${noteBlock}\n\n■対象の撮影\n${shoot}\n\nご不明な点は、このメールにご返信ください。\n${FOOTER(origin)}` });
    }
    if (status === 'approved' && photographer && photographer.profile_id) {
      const [pro] = await restSelect(env, 'profiles', { id: `eq.${photographer.profile_id}`, select: 'email' });
      if (pro && pro.email) {
        await sendEmail(env, { to: pro.email, subject: '【PhotoMatch】マッチング数保証による無料再撮影が決まりました', text: `${photographer.name} さん\n\n以下の撮影について、マッチング数保証による無料再撮影が決まりました。お客様がマイページから日時を選ぶと、通常の予約と同じく「新しい予約」のメールが届きます（料金は¥0、報酬の対象外です）。受け付けられる日時は、管理画面のシフトで開けておいてください。\n\n■元の撮影\n依頼者：${(booking && booking.customer_name) || '-'} 様\n${shoot}\n\n${origin}/admin.html\n${FOOTER(origin)}` });
      }
    }
  } catch (err) {
    console.error('guarantee/review: email failed', err);
  }
  return jsonResponse({ ok: true });
}
