// Booking confirmed / canceled notifications, sent to the customer, the
// photographer and ops at the same time. Never throws: a mail failure must
// not break the payment webhook or the cancel request that triggered it.
import { meetingPointForArea, EXTRA_OPTIONS, WEEKDAY_JP } from '../../js/data.js';
import { restSelect } from './supabaseAdmin.js';
import { sendEmail } from './email.js';

const CANCEL_POLICY = '撮影日の3日前まで：無料 ／ 2日前：プラン料金の50% ／ 前日・当日：プラン料金の100%（オプション料金は全額返金）';
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
  const meeting = meetingPointForArea(b.area);
  return [
    forCustomer ? `カメラマン：${photographerName}` : null,
    `日時：${formatDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}`,
    `プラン：${b.plan_name}${b.monitor_application_id ? '（モニター価格）' : ''}${forCustomer ? `（¥${b.plan_price.toLocaleString()}）` : ''}`,
    options.length ? `オプション：${options.join('、')}` : null,
    forCustomer ? `お支払い合計：¥${b.total_price.toLocaleString()}（税込）` : null,
    `撮影エリア：${b.area || '-'}`,
    meeting ? `集合場所：${meeting.detail}` : null,
  ].filter(Boolean).join('\n');
}

const yen = (n) => `¥${Number(n || 0).toLocaleString()}`;

function refundLines(b) {
  if (!b.total_price || b.refund_status == null) return '';
  const refund = b.refund_amount || 0;
  const how = b.refund_status === 'succeeded'
    ? 'ご利用のカードへ返金しました。カード会社によって、明細への反映まで数日〜2週間ほどかかる場合があります。'
    : b.refund_status === 'failed' || b.refund_status === 'pending'
      ? '運営より順次ご返金のお手続きをいたします。'
      : '';
  return `\n\n■キャンセル料・ご返金\nキャンセル料：${yen(b.cancel_fee)}\nご返金額：${yen(refund)}${refund > 0 && how ? `\n${how}` : ''}`;
}

const REFUND_STATUS_LABEL = { none: '返金なし', pending: '処理中', succeeded: '返金済み', failed: '【要対応】自動返金に失敗。Stripeの管理画面から手動で返金してください' };

const FOOTER = (origin) => `\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：${CONTACT}`;

function messages(kind, b, photographerName, origin) {
  const when = `${shortDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜`;
  if (kind === 'confirmed') {
    return {
      customer: {
        subject: `【PhotoMatch】ご予約が確定しました（${when}）`,
        text: `${b.customer_name} 様\n\nPhotoMatchをご利用いただきありがとうございます。\n以下の内容でご予約が確定しました。\n\n■ご予約内容\n${bookingLines(b, photographerName, { forCustomer: true })}\n\n当日は集合場所で直接お待ち合わせください。\n予約内容の確認・カメラマンとのメッセージ・日程変更・キャンセルはマイページからご利用いただけます。\n${origin}/mypage.html\n\n■日程変更について\n撮影日の3日前まで：無料で日程変更できます。\n2日前〜撮影前：「あんしん振替プラン」にご加入の場合、1回まで無料で日程変更できます。\n\n■キャンセルポリシー\n${CANCEL_POLICY}\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】新しい予約が入りました（${when}）`,
        text: `${photographerName} さん\n\n新しい予約が確定しました。\n\n■予約内容\n依頼者：${b.customer_name} 様\n連絡先：${b.customer_contact}\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n依頼者とのメッセージ・シフトの確認は管理画面からご利用いただけます。\n${origin}/admin.html\n${FOOTER(origin)}`,
      },
    };
  }
  if (kind === 'ops_canceled') {
    return {
      customer: {
        subject: `【PhotoMatch】ご予約をキャンセルいたしました（${when}）`,
        text: `${b.customer_name} 様\n\n誠に申し訳ございません。${b.cancel_note || '運営の判断により'}、以下のご予約をキャンセルいたしました。\n\n■キャンセルしたご予約\n${bookingLines(b, photographerName, { forCustomer: true })}${refundLines(b)}\n\n別の日時でのご予約は、下記からお選びいただけます。ご不明な点は、このメールにご返信ください。\n${origin}/search.html\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】予約が運営によりキャンセルされました（${when}）`,
        text: `${photographerName} さん\n\n以下の予約を、運営がキャンセルしました（${b.cancel_note || '運営の判断'}）。この枠は再び予約を受け付けられる状態になっています。\n\n■キャンセルされた予約\n依頼者：${b.customer_name} 様\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n${origin}/admin.html\n${FOOTER(origin)}`,
      },
    };
  }
  if (kind === 'rescheduled' || kind === 'ops_rescheduled') {
    const byOps = kind === 'ops_rescheduled';
    const was = b.previous_booking_date ? `${formatDate(b.previous_booking_date)} ${String(b.previous_start_time).slice(0, 5)}〜` : '-';
    const change = `■変更前\n${was}\n\n■変更後\n${bookingLines(b, photographerName, { forCustomer: true })}`;
    return {
      customer: {
        subject: `【PhotoMatch】ご予約の日程を変更しました（${when}）`,
        text: `${b.customer_name} 様\n\n${byOps ? '運営にて、ご予約の日程を変更いたしました。' : 'ご予約の日程変更を承りました。'}\n\n${change}\n\n当日は集合場所で直接お待ち合わせください。\n予約内容の確認・カメラマンとのメッセージはマイページからご利用いただけます。\n${origin}/mypage.html\n\n■キャンセルポリシー\n${CANCEL_POLICY}\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】予約の日程が変更されました（${when}）`,
        text: `${photographerName} さん\n\n以下の予約の日程が、${byOps ? '運営により' : '依頼者により'}変更されました。元の枠は再び予約を受け付けられる状態になり、変更後の枠が埋まりました。\n\n依頼者：${b.customer_name} 様\n連絡先：${b.customer_contact}\n\n■変更前\n${was}\n\n■変更後\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n${origin}/admin.html\n${FOOTER(origin)}`,
      },
    };
  }
  if (kind === 'no_show') {
    return {
      customer: {
        subject: `【PhotoMatch】ご予約を当日キャンセル扱いとしました（${when}）`,
        text: `${b.customer_name} 様\n\n以下のご予約について、集合時間に15分以上遅れてのご来場（またはご来場がなかった）ため、利用規約第5条に基づき当日キャンセルとして扱いました。\n\n■対象のご予約\n${bookingLines(b, photographerName, { forCustomer: true })}${refundLines(b)}\n\n内容に心当たりがない場合は、お手数ですが下記までご連絡ください。\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】遅刻のため当日キャンセル扱いになりました（${when}）`,
        text: `${photographerName} さん\n\n以下の予約は、依頼者の遅刻（15分以上）のため、運営にて当日キャンセルとして処理しました。\n\n■対象の予約\n依頼者：${b.customer_name} 様\n${bookingLines(b, photographerName, { forCustomer: false })}\n\n補償として${yen(b.photographer_cancel_comp)}をお支払いします（通常の報酬と同じく、月末締め・翌月25日払い）。\n\n${origin}/admin.html\n${FOOTER(origin)}`,
      },
    };
  }
  return {
    customer: {
      subject: `【PhotoMatch】ご予約をキャンセルしました（${when}）`,
      text: `${b.customer_name} 様\n\n以下のご予約のキャンセルを承りました。\n\n■キャンセルしたご予約\n${bookingLines(b, photographerName, { forCustomer: true })}${refundLines(b)}\n\nまたのご利用をお待ちしております。\n${FOOTER(origin)}`,
    },
    photographer: {
      subject: `【PhotoMatch】予約がキャンセルされました（${when}）`,
      text: `${photographerName} さん\n\n以下の予約が依頼者によりキャンセルされました。この枠は再び予約を受け付けられる状態になっています。\n\n■キャンセルされた予約\n依頼者：${b.customer_name} 様\n${bookingLines(b, photographerName, { forCustomer: false })}${b.photographer_cancel_comp ? `\n\n当日のキャンセルのため、補償として${yen(b.photographer_cancel_comp)}をお支払いします（通常の報酬と同じく、月末締め・翌月25日払い）。` : ''}\n\n${origin}/admin.html\n${FOOTER(origin)}`,
    },
  };
}

// Ops copy: every booking and cancellation, with what ops may need to act on
// (a refund that failed, a same-day compensation to pay out).
function opsMessage(kind, b, photographerName, origin) {
  const head = { confirmed: '新しい予約', canceled: '予約キャンセル', no_show: '遅刻キャンセルの処理', rescheduled: '予約の日程変更', ops_canceled: '運営によるキャンセル', ops_rescheduled: '運営による日程変更' }[kind];
  const refund = (kind === 'canceled' || kind === 'no_show' || kind === 'ops_canceled') && b.total_price
    ? `\n\nキャンセル料：${yen(b.cancel_fee)}\n返金額：${yen(b.refund_amount)}（${REFUND_STATUS_LABEL[b.refund_status] || b.refund_status || '-'}）${b.photographer_cancel_comp ? `\nカメラマンへの当日キャンセル補償：${yen(b.photographer_cancel_comp)}` : ''}`
    : '';
  return {
    subject: `【PhotoMatch運営】${head}${b.refund_status === 'failed' ? '・要返金対応' : ''}（${shortDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜 ${photographerName}）`,
    text: `${head}がありました。${kind === 'ops_canceled' && b.cancel_note ? `\n理由：${b.cancel_note}` : ''}${(kind === 'rescheduled' || kind === 'ops_rescheduled') && b.previous_booking_date ? `\n変更前：${formatDate(b.previous_booking_date)} ${String(b.previous_start_time).slice(0, 5)}〜${b.reschedule_plan_used ? '（あんしん振替プランの無料1回を使用）' : ''}` : ''}\n\n予約ID：${b.id}\n依頼者：${b.customer_name} 様（${b.customer_contact || '-'}）${b.customer_gender ? `\n依頼者の性別：${{ male: '男性', female: '女性', other: '回答しない' }[b.customer_gender] || '-'}（異性スタッフ写真セレクトの担当判定用）` : ''}\n${bookingLines(b, photographerName, { forCustomer: true })}${refund}\n\n${origin}/ops.html\n`,
  };
}

// kind: 'confirmed' | 'canceled' | 'no_show' | 'rescheduled' | 'ops_canceled' | 'ops_rescheduled'
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
    sends.push(sendEmail(env, { to: env.OPS_EMAIL || CONTACT, ...opsMessage(kind, booking, photographerName, origin) }));
    const results = await Promise.allSettled(sends);
    results.filter((r) => r.status === 'rejected').forEach((r) => console.error('notifyBooking send failed', r.reason));
  } catch (err) {
    console.error('notifyBooking failed', err);
  }
}

// Plain alert to ops (info.photomatch@gmail.com, or OPS_EMAIL) for things that
// need a human: a payment that couldn't become a booking, a failed refund.
// Never throws, like notifyBooking.
export async function notifyOps(env, subject, text, origin) {
  try {
    await sendEmail(env, { to: env.OPS_EMAIL || CONTACT, subject: `【PhotoMatch運営】${subject}`, text: `${text}\n\n${origin}/ops.html\n` });
  } catch (err) {
    console.error('notifyOps failed', err);
  }
}
