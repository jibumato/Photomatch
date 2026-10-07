// Booking confirmed / canceled notifications, sent to the customer, the
// photographer and ops at the same time. Never throws: a mail failure must
// not break the payment webhook or the cancel request that triggered it.
import { meetingPointForArea, mapUrlFor, WEEKDAY_JP, PHOTOGRAPHER_ACK_HOURS, bookingOptionItems, splitCustomerContact } from '../../js/data.js';
import { restSelect, restUpdate } from './supabaseAdmin.js';
import { sendEmail } from './email.js';
import { bookingIcs, icsAttachment } from './ics.js';
import { ackUrl } from './ackToken.js';
import { pushToPhotographer, clip } from './line.js';

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

// "注文番号：PM261007-0012" — on every email, so a booking can be found by it.
const orderLine = (b) => (b.order_number ? `注文番号：${b.order_number}` : null);

function bookingLines(b, photographerName, { forCustomer }) {
  const options = bookingOptionItems(b).map((o) => o.label);
  const meeting = meetingPointForArea(b.area);
  return [
    orderLine(b),
    forCustomer ? `カメラマン：${photographerName}` : null,
    `日時：${formatDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}`,
    `プラン：${b.plan_name}${b.monitor_application_id ? '（モニター価格）' : ''}${b.reshoot_of ? '（マッチング数保証による無料再撮影）' : ''}${forCustomer ? `（¥${b.plan_price.toLocaleString()}）` : ''}`,
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

function messages(kind, b, photographerName, origin, customerEmail) {
  const when = `${shortDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜`;
  if (kind === 'confirmed') {
    const { phone } = splitCustomerContact(b.customer_contact);
    const meeting = meetingPointForArea(b.area);
    const options = bookingOptionItems(b);
    const received = b.created_at ? new Date(b.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    const schedule = [
      `撮影日時：${formatDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜${b.end_time.slice(0, 5)}${b.duration_min ? `（${b.duration_min}分）` : ''}`,
      `撮影エリア：${b.area || '-'}`,
      meeting ? `集合場所：${meeting.detail}\n地図：${mapUrlFor(meeting)}` : null,
    ].filter(Boolean).join('\n');
    const planLabel = `${b.plan_name}${b.monitor_application_id ? '（モニター価格）' : ''}${b.reshoot_of ? '（マッチング数保証による無料再撮影）' : ''}`;
    const fees = [
      `${planLabel}：${yen(b.plan_price)}`,
      ...options.map((o) => `${o.label}：${yen(o.price)}`),
      `合計：${yen(b.total_price)}`,
      b.total_price > 0 ? 'お支払い方法：クレジットカード（お支払い済み）' : null,
    ].filter(Boolean).join('\n');
    return {
      customer: {
        subject: `【PhotoMatch】ご予約が確定しました（${when}${b.order_number ? `／注文番号 ${b.order_number}` : ''}）`,
        text: `${b.customer_name} 様\n\nPhotoMatchをご利用いただきありがとうございます。\n以下の内容でご予約が確定しました。お問い合わせの際は、注文番号をお知らせください。\n\n■ご予約番号\n${[orderLine(b), received ? `受付日時：${received}` : null].filter(Boolean).join('\n')}\n\n■ご予約者情報\nお名前：${b.customer_name} 様\nメールアドレス：${customerEmail || splitCustomerContact(b.customer_contact).email || '-'}\n電話番号：${phone || '（未入力）'}\n\n■ご予約内容\nカメラマン：${photographerName}\n${schedule}\n\n■ご利用料金（税込）\n${fees}\n\n当日は集合場所で直接お待ち合わせください。\n予約内容の確認・カメラマンとのメッセージ・事前カウンセリングの回答・日程変更・キャンセルはマイページからご利用いただけます。\n${origin}/mypage.html\n\n■日程変更について\n撮影日の3日前まで：無料で日程変更できます。\n2日前〜撮影前：「あんしん振替プラン」にご加入の場合、1回まで無料で日程変更できます。\n\n■キャンセルポリシー\n${CANCEL_POLICY}\n${FOOTER(origin)}`,
      },
      photographer: {
        subject: `【PhotoMatch】新しい予約が入りました（${when}${b.order_number ? `／${b.order_number}` : ''}）`,
        text: `${photographerName} さん\n\n新しい予約が確定しました。\n\n■予約者情報\nお名前：${b.customer_name} 様\n連絡先：${b.customer_contact || '-'}\n\n■予約内容\n${orderLine(b) ? `${orderLine(b)}\n` : ''}${schedule}\nプラン：${planLabel}\nオプション：${options.length ? options.map((o) => o.label).join('、') : 'なし'}\n\n依頼者とのメッセージ・事前カウンセリングの回答・シフトの確認は管理画面からご利用いただけます。\n${origin}/admin.html\n${FOOTER(origin)}`,
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
    subject: `【PhotoMatch運営】${head}${b.refund_status === 'failed' ? '・要返金対応' : ''}（${shortDate(b.booking_date)} ${b.start_time.slice(0, 5)}〜 ${photographerName}${b.order_number ? `／${b.order_number}` : ''}）`,
    text: `${head}がありました。${kind === 'ops_canceled' && b.cancel_note ? `\n理由：${b.cancel_note}` : ''}${(kind === 'rescheduled' || kind === 'ops_rescheduled') && b.previous_booking_date ? `\n変更前：${formatDate(b.previous_booking_date)} ${String(b.previous_start_time).slice(0, 5)}〜${b.reschedule_plan_used ? '（あんしん振替プランの無料1回を使用）' : ''}` : ''}\n\n予約ID：${b.id}\n依頼者：${b.customer_name} 様（${b.customer_contact || '-'}）${b.customer_gender ? `\n依頼者の性別：${{ male: '男性', female: '女性', other: '回答しない' }[b.customer_gender] || '-'}（異性スタッフ写真セレクトの担当判定用）` : ''}\n${bookingLines(b, photographerName, { forCustomer: true })}${refund}\n\n${origin}/ops.html\n`,
  };
}

// Kinds that put a (new) date on the photographer's calendar: these ask the
// photographer to press 「確認しました」 again and carry an .ics file.
const ACK_KINDS = ['confirmed', 'rescheduled', 'ops_rescheduled'];
const CANCEL_KINDS = ['canceled', 'ops_canceled'];

// Adds a paragraph just above the common footer of a message.
function withExtra(text, extra, origin) {
  return text.replace(FOOTER(origin), `\n${extra}\n${FOOTER(origin)}`);
}

function photographerAckText(link) {
  return `■予約の確認をお願いします\n内容を確認したら、下のリンクを開いて「確認しました」を押してください（管理画面の予約一覧からも押せます）。${PHOTOGRAPHER_ACK_HOURS}時間以内に確認がない場合は、運営からご連絡します。\n${link}`;
}

function calendarText(kind) {
  if (kind === 'confirmed') return '■カレンダーへの登録\n添付のファイル（photomatch-booking.ics）を開くと、カレンダーに予定を追加できます（前日と1時間前に通知されます）。';
  if (CANCEL_KINDS.includes(kind)) return '■カレンダーについて\nカレンダーに登録済みの場合は、予定を削除してください（添付のファイルを開くと削除できるカレンダーもあります）。';
  return '■カレンダーへの登録\nカレンダーに登録済みの場合は、変更前の予定を削除し、添付のファイル（photomatch-booking.ics）を開いて登録し直してください。';
}

// LINE version of the photographer's notice: the essentials in one text,
// plus 「確認しました」 / 管理画面 buttons when a (new) date needs confirming.
// Both go in one push, which counts as one message toward LINE's monthly limit.
function ackButtons(b, origin, lead) {
  const r = b.ack_requested_at ? new Date(b.ack_requested_at).getTime() : '';
  return {
    type: 'template',
    altText: '予約の確認をお願いします',
    template: {
      type: 'buttons',
      text: clip(lead, 160),
      actions: [
        { type: 'postback', label: '確認しました', data: `ack=${b.id}&r=${r}`, displayText: '確認しました' },
        { type: 'uri', label: '管理画面を開く', uri: `${origin}/admin.html` },
      ],
    },
  };
}

function lineBookingMessages(kind, b, origin) {
  const when = (date, start, end) => `${formatDate(date)} ${String(start).slice(0, 5)}〜${end ? String(end).slice(0, 5) : ''}`;
  const options = bookingOptionItems(b).map((o) => o.label);
  const meeting = meetingPointForArea(b.area);
  const detail = [
    ...(b.order_number ? [`注文番号：${b.order_number}`] : []),
    when(b.booking_date, b.start_time, b.end_time),
    `${b.customer_name} 様／${b.plan_name}${options.length ? `＋${options.join('、')}` : ''}`,
    `${b.area || '-'}${meeting ? `（集合：${meeting.detail}）` : ''}`,
  ].join('\n');
  const head = {
    confirmed: '【新しい予約】',
    rescheduled: '【日程変更（依頼者）】',
    ops_rescheduled: '【日程変更（運営）】',
    canceled: '【キャンセル】',
    ops_canceled: '【運営によるキャンセル】',
    no_show: '【遅刻のため当日キャンセル扱い】',
  }[kind];
  if (!head) return null;
  const was = (kind === 'rescheduled' || kind === 'ops_rescheduled') && b.previous_booking_date
    ? `変更前：${when(b.previous_booking_date, b.previous_start_time)}\n変更後：` : '';
  const comp = b.photographer_cancel_comp ? `\n補償：${yen(b.photographer_cancel_comp)}` : '';
  const messages = [{ type: 'text', text: clip(`${head}\n${was}${detail}${CANCEL_KINDS.includes(kind) || kind === 'no_show' ? comp : ''}`, 4900) }];
  if (ACK_KINDS.includes(kind)) {
    messages.push(ackButtons(b, origin, `内容を確認したら「確認しました」を押してください（${PHOTOGRAPHER_ACK_HOURS}時間以内に確認がない場合、運営からご連絡します）。`));
  } else {
    messages.push({ type: 'text', text: `詳細は管理画面から確認できます。\n${origin}/admin.html` });
  }
  return messages;
}

// kind: 'confirmed' | 'canceled' | 'no_show' | 'rescheduled' | 'ops_canceled' | 'ops_rescheduled'
export async function notifyBooking(env, bookingId, kind, origin) {
  try {
    let [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
    if (!booking) return;
    if (ACK_KINDS.includes(kind)) {
      // A new date to confirm: start (or restart) the photographer's 確認 clock.
      const now = new Date().toISOString();
      const [updated] = await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, { ack_requested_at: now, photographer_ack_at: null, ack_alerted_at: null });
      booking = { ...booking, ...(updated || {}), ack_requested_at: now, photographer_ack_at: null, ack_alerted_at: null };
    }
    const [photographer] = await restSelect(env, 'photographers', {
      id: `eq.${booking.photographer_id}`, select: 'name,profile_id',
    });
    const profileIds = [booking.client_id, photographer && photographer.profile_id].filter(Boolean);
    const profiles = await restSelect(env, 'profiles', { id: `in.(${profileIds.join(',')})`, select: 'id,email' });
    const emailOf = (id) => (profiles.find((p) => p.id === id) || {}).email;

    const photographerName = (photographer && photographer.name) || 'カメラマン';
    const msg = messages(kind, booking, photographerName, origin, emailOf(booking.client_id));
    const attach = { customer: [], photographer: [] };
    if (ACK_KINDS.includes(kind)) {
      msg.photographer.text = withExtra(msg.photographer.text, photographerAckText(await ackUrl(env, origin, booking)), origin);
    }
    if (ACK_KINDS.includes(kind) || CANCEL_KINDS.includes(kind)) {
      const method = CANCEL_KINDS.includes(kind) ? 'CANCEL' : 'PUBLISH';
      for (const who of ['customer', 'photographer']) {
        attach[who].push(icsAttachment(bookingIcs(booking, { photographerName, audience: who, method, origin })));
        msg[who].text = withExtra(msg[who].text, calendarText(kind), origin);
      }
    }
    const customerEmail = emailOf(booking.client_id);
    const photographerEmail = photographer && photographer.profile_id ? emailOf(photographer.profile_id) : null;

    if (!photographerEmail) {
      console.warn(`notifyBooking: photographer ${booking.photographer_id} has no linked account email; not notified`);
    }
    const sends = [];
    if (customerEmail) sends.push(sendEmail(env, { to: customerEmail, ...msg.customer, attachments: attach.customer }));
    if (photographerEmail) sends.push(sendEmail(env, { to: photographerEmail, ...msg.photographer, attachments: attach.photographer }));
    sends.push(sendEmail(env, { to: env.OPS_EMAIL || CONTACT, ...opsMessage(kind, booking, photographerName, origin) }));
    const lineMessages = lineBookingMessages(kind, booking, origin);
    if (lineMessages) sends.push(pushToPhotographer(env, booking.photographer_id, lineMessages));
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

// The photographer hasn't pressed 「確認しました」 within PHOTOGRAPHER_ACK_HOURS:
// tell ops (to call them) and remind the photographer once more. Returns true
// when the ops email went out. Called by /api/bookings/ack-check.
export async function notifyAckOverdue(env, booking, origin) {
  try {
    const [photographer] = await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: 'name,profile_id' });
    const photographerName = (photographer && photographer.name) || 'カメラマン';
    const [profile] = photographer && photographer.profile_id
      ? await restSelect(env, 'profiles', { id: `eq.${photographer.profile_id}`, select: 'email' })
      : [];
    const when = `${formatDate(booking.booking_date)} ${booking.start_time.slice(0, 5)}〜`;
    const link = await ackUrl(env, origin, booking);
    const sends = [sendEmail(env, {
      to: env.OPS_EMAIL || CONTACT,
      subject: `【PhotoMatch運営】カメラマンが予約を未確認です（${shortDate(booking.booking_date)} ${booking.start_time.slice(0, 5)}〜 ${photographerName}）`,
      text: `${photographerName} さんが、${PHOTOGRAPHER_ACK_HOURS}時間たっても予約を確認していません。電話などで連絡を取り、予約に気づいているか確認してください。\n\n予約ID：${booking.id}\n確認を依頼した日時：${new Date(booking.ack_requested_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\nカメラマンの連絡先：${(profile && profile.email) || '（アカウント未連携）'}\n依頼者：${booking.customer_name} 様\n${bookingLines(booking, photographerName, { forCustomer: true })}\n\n${origin}/ops.html\n`,
    })];
    sends.push(pushToPhotographer(env, booking.photographer_id, [
      { type: 'text', text: clip(`【予約が未確認です】\n${when}\n${booking.customer_name} 様／${booking.plan_name}`, 4900) },
      ackButtons(booking, origin, '内容を確認して「確認しました」を押してください。'),
    ]));
    if (profile && profile.email) {
      sends.push(sendEmail(env, {
        to: profile.email,
        subject: `【PhotoMatch】予約の確認をお願いします（${shortDate(booking.booking_date)} ${booking.start_time.slice(0, 5)}〜）`,
        text: `${photographerName} さん\n\n以下の予約が、まだ確認されていません。内容を確認して、下のリンクから「確認しました」を押してください。\n\n依頼者：${booking.customer_name} 様\n日時：${when}\n${bookingLines(booking, photographerName, { forCustomer: false })}\n\n${link}\n${FOOTER(origin)}`,
      }));
    }
    const [opsResult] = await Promise.allSettled(sends);
    if (opsResult.status === 'rejected') {
      console.error('notifyAckOverdue: ops email failed', opsResult.reason);
      return false;
    }
    return true;
  } catch (err) {
    console.error('notifyAckOverdue failed', err);
    return false;
  }
}
