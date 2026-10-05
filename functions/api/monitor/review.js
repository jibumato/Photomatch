// POST /api/monitor/review  { application_id, status: 'accepted' | 'rejected', note }
// ops-only. Records the モニター審査 result and emails it to the applicant
// (the monitor page promises the result "by email"). Done server-side so
// the email can't be skipped and only ops can decide a result.
import { MONITOR_PLAN_NAMES, MONITOR_CAPACITY } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { sendEmail } from '../../_lib/email.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function message(status, name, note, origin) {
  const footer = `\n――――――――――\nPhotoMatch\n${origin}/\nお問い合わせ：info.photomatch@gmail.com`;
  const noteBlock = note ? `\n\n運営より：\n${note}` : '';
  if (status === 'accepted') {
    return {
      subject: '【PhotoMatch】モニター価格プランに当選しました',
      text: `${name || 'お客'} 様\n\nモニター価格プランにご応募いただきありがとうございます。\n厳正な審査の結果、当選となりました。${noteBlock}\n\n■ご予約の方法\n応募に使ったアカウントでログインし、通常の予約ページから撮影日時をお選びください。\n${MONITOR_PLAN_NAMES.join('・')}のいずれかをお選びいただくと、お支払い画面でモニター価格（半額）が自動で適用されます（1回限り）。\n${origin}/search.html\n${footer}`,
    };
  }
  return {
    subject: '【PhotoMatch】モニター価格プランの審査結果のお知らせ',
    text: `${name || 'お客'} 様\n\nモニター価格プランにご応募いただきありがとうございます。\n誠に残念ながら、今回はご希望に添えない結果となりました。${noteBlock}\n\n通常のプランは引き続きご予約いただけます。\n${origin}/search.html\n${footer}`,
  };
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const applicationId = payload && payload.application_id;
  const status = payload && payload.status;
  const note = ((payload && payload.note) || '').trim() || null;
  if (!applicationId) return jsonResponse({ error: 'application_idが必要です。' }, 400);
  if (!['accepted', 'rejected'].includes(status)) return jsonResponse({ error: '審査結果が不正です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  // 先着の定員を超えて当選させない。
  if (status === 'accepted') {
    const accepted = await restSelect(env, 'monitor_applications', { status: 'in.(accepted,completed)', select: 'id' });
    if (accepted.length >= MONITOR_CAPACITY) return jsonResponse({ error: `定員（${MONITOR_CAPACITY}名）に達しているため、これ以上当選にできません。` }, 409);
  }

  // Only an application still awaiting review can be decided, so a double
  // click can't send the applicant two emails.
  const updated = await restUpdate(
    env,
    'monitor_applications',
    { id: `eq.${applicationId}`, status: 'eq.applied' },
    { status, review_note: note, reviewed_at: new Date().toISOString(), reviewed_by: user.id },
  );
  if (!updated.length) return jsonResponse({ error: 'この応募はすでに審査済みか、見つかりません。' }, 409);

  let emailed = false;
  try {
    const [applicant] = await restSelect(env, 'profiles', { id: `eq.${updated[0].client_id}`, select: 'name,email' });
    if (applicant && applicant.email) {
      const result = await sendEmail(env, { to: applicant.email, ...message(status, applicant.name, note, new URL(request.url).origin) });
      emailed = !result.skipped;
    }
  } catch (err) {
    console.error('monitor/review: email failed', err);
  }
  return jsonResponse({ ok: true, emailed });
}
