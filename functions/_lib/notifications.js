// Booking confirmed / canceled notifications, sent to the customer and the
// photographer at the same time. Never throws: a mail failure must not
// break the payment webhook or the cancel request that triggered it.
import { MEETING_POINTS, EXTRA_OPTIONS, WEEKDAY_JP } from '../../js/data.js';
import { restSelect } from './supabaseAdmin.js';
import { sendEmail } from './email.js';

const CANCEL_POLICY = '撮影日の3日前まで：無料 ／ 2日前：料金の50% ／ 前日・当日：料金の100%';
const CONTACT = 'info.photomatch@gmail.com';

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = WEEKDAY_JP[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

function shortDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

function bookingLines(b, photographerName, { forCustomer }) {
  const options = (b.options || [])
    .map((o) => EXTRA_OPTIONS.find((eo) => eo.key === o.key))
    .filter(Boolean)
    .map((o) => o.label);
  const meeting = MEETING_POINTS.find((mp) => (b.area || '').startsWith(mp.label));
  return [
    forCustomer ? `カメラマン：${photographerName}` : null,
    `日時：${formatDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}`,
    `プラン：${b.plan_name}${forCustomer ? `（¥${b.plan_price.toLocaleString()}）` : ''}`,
    options.length ? `オプション：${options.join('、')}` : null,
    forCustomer ? `お支払い合計：¥${b.total_price.toLocaleString()}（税込）` : null,
    `撮影エリア：${b.area || '-'}`,
    meeting ? `集合場所：${meeting.detail}` : null,
  ].filter(Boolean).join('\n');
}

const FOOTER = (origin) => `\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：${CONTACT}`;

function messages(kind, b, photographerName, origin) {
  const when = `${shortDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜`;
  if (kind === 'confirmed') {
    return {
      customer: {
        subject: `【PhotoMatch】ご予約が確定しました（${when}）`,
        text: `${b.customer_name} 様\n\nPhotoMatchをご利用いただきありがとうございます。\n以下の内容でご予約が確定しました。\n\n■ご予約内容\n${bookingLines(b, photographerName, { forCustomer: true })}\n\n当日は集合場所で直接お待ち合わせください。\n予約内容の確認・カメラマンとのメッセージはマイページからご利用いただけます。\n${origin}/mypage.html\n\n■キャンセルポリシー\n${CANCEL_POLICY}\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】新しい予約が入りました（${when}）`,
        text: `${photographerName} さん\n\n新しい予約が確定しました。\n\n■予約内容\n依頼者：${b.customer_name} 様\n連絡先：${b.customer_contact}\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n依頼者とのメッセージ・シフトの確認は管理画面からご利用いただけます。\n${origin}/admin.html\n${FOOTER(origin)}`,
      },
    };
  }
  return {
    customer: {
      subject: `【PhotoMatch】ご予約をキャンセルしました（${when}）`,
      text: `${b.customer_name} 様\n\n以下のご予約のキャンセルを承りました。\n\n■キャンセルしたご予約\n${bookingLines(b, photographerName, { forCustomer: true })}\n\nまたのご利用をお待ちしております。\n${FOOTER(origin)}`,
    },
    photographer: {
      subject: `【PhotoMatch】予約がキャンセルされました（${when}）`,
      text: `${photographerName} さん\n\n以下の予約が依頼者によりキャンセルされました。この枠は再び予約を受け付けられる状態になっています。\n\n■キャンセルされた予約\n依頼者：${b.customer_name} 様\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n${origin}/admin.html\n${FOOTER(origin)}`,
    },
  };
}

// kind: 'confirmed' | 'canceled'
export async function notifyBooking(env, bookingId, kind, origin) {
  try {
    const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
    if (!booking) return;
    const [photographer] = await restSelect(env, 'photographers', {
      id: `eq.${booking.photographer_id}`, select: 'name,profile_id',
    });
    const profileIds = [booking.client_id, photographer && photographer.profile_id].filter(Boolean);
    const profiles = await restSelect(env, 'profiles', { id: `in.(${profileIds.join(',')})`, select: 'id,email' });
    const emailOf = (id) => (profiles.find((p) => p.id === id) || {}).email;

    const photographerName = (photographer && photographer.name) || 'カメラマン';
    const msg = messages(kind, booking, photographerName, origin);
    const customerEmail = emailOf(booking.client_id);
    const photographerEmail = photographer && photographer.profile_id ? emailOf(photographer.profile_id) : null;

    if (!photographerEmail) {
      console.warn(`notifyBooking: photographer ${booking.photographer_id} has no linked account email; not notified`);
    }
    const sends = [];
    if (customerEmail) sends.push(sendEmail(env, { to: customerEmail, ...msg.customer }));
    if (photographerEmail) sends.push(sendEmail(env, { to: photographerEmail, ...msg.photographer }));
    const results = await Promise.allSettled(sends);
    results.filter((r) => r.status === 'rejected').forEach((r) => console.error('notifyBooking send failed', r.reason));
  } catch (err) {
    console.error('notifyBooking failed', err);
  }
}
