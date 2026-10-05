// POST /api/notify/ops  { kind: 'guarantee_claim' | 'monitor_application', id }
// Called by the browser right after a customer submits a マッチング数保証
// claim or a monitor application, so ops hears about it without watching
// ops.html. Sends once per record (ops_notified_at), only for the caller's own
// record and only shortly after it was submitted.
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { notifyOps } from '../../_lib/notifications.js';

const RECENT_MS = 10 * 60 * 1000;

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
  const { kind, id } = payload || {};
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const origin = new URL(request.url).origin;

  if (kind === 'guarantee_claim') {
    const [claim] = await restSelect(env, 'guarantee_claims', { id: `eq.${id}`, select: '*' });
    if (!claim || claim.client_id !== user.id) return jsonResponse({ error: '見つかりません。' }, 404);
    if (claim.status !== 'claimed' || claim.ops_notified_at || !claim.claim_submitted_at || Date.now() - new Date(claim.claim_submitted_at).getTime() > RECENT_MS) return jsonResponse({ ok: true, sent: false });
    const marked = await restUpdate(env, 'guarantee_claims', { id: `eq.${id}`, ops_notified_at: 'is.null' }, { ops_notified_at: new Date().toISOString() });
    if (!marked.length) return jsonResponse({ ok: true, sent: false });
    const [booking] = await restSelect(env, 'bookings', { id: `eq.${claim.booking_id}`, select: 'booking_date,start_time,customer_name,photographer_id' });
    await notifyOps(env, 'マッチング数保証の申請がありました', `依頼者：${(booking && booking.customer_name) || '-'}\n撮影日：${booking ? `${booking.booking_date} ${booking.start_time.slice(0, 5)}〜` : '-'}\n申請内容：${claim.claim_note || '（記入なし）'}\n\n運営画面「マッチング数保証・再撮影補償の審査」から審査してください。`, origin);
    return jsonResponse({ ok: true, sent: true });
  }
  if (kind === 'monitor_application') {
    const [app] = await restSelect(env, 'monitor_applications', { id: `eq.${id}`, select: '*' });
    if (!app || app.client_id !== user.id) return jsonResponse({ error: '見つかりません。' }, 404);
    if (app.ops_notified_at || Date.now() - new Date(app.applied_at).getTime() > RECENT_MS) return jsonResponse({ ok: true, sent: false });
    const marked = await restUpdate(env, 'monitor_applications', { id: `eq.${id}`, ops_notified_at: 'is.null' }, { ops_notified_at: new Date().toISOString() });
    if (!marked.length) return jsonResponse({ ok: true, sent: false });
    const [applicant] = await restSelect(env, 'profiles', { id: `eq.${user.id}`, select: 'name,email' });
    await notifyOps(env, 'モニター価格プランに応募がありました', `応募者：${(applicant && applicant.name) || '-'}（${(applicant && applicant.email) || '-'}）\n使用中のアプリ：${app.current_apps || '-'}\n応募理由：${app.motivation || '-'}\n\n運営画面「モニター価格プランの応募審査」から審査してください。`, origin);
    return jsonResponse({ ok: true, sent: true });
  }
  return jsonResponse({ error: '不正なリクエストです。' }, 400);
}
