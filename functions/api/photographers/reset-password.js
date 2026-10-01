// POST /api/photographers/reset-password  { email }
// ops-only. Issues a fresh temp password for an existing *photographer*
// account, for when the original was mistyped / lost or the emailed reset
// link couldn't be used. Only photographer accounts can be reset here — ops
// and customer passwords are never touched by this endpoint.
import { verifyUser, getProfile, restSelect, adminSetPassword } from '../../_lib/supabaseAdmin.js';
import { generatePassword } from '../../_lib/tempPassword.js';

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
  const email = ((payload && payload.email) || '').trim().toLowerCase();
  if (!email) return jsonResponse({ error: 'メールアドレスが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const caller = await getProfile(env, user.id);
  if (!caller || caller.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  let target;
  try {
    const rows = await restSelect(env, 'profiles', { email: `eq.${email}`, select: 'id,role,email' });
    target = rows[0];
  } catch (err) {
    console.error('photographers/reset-password lookup failed', err);
    return jsonResponse({ error: 'アカウントの検索に失敗しました。' }, 502);
  }
  if (!target) return jsonResponse({ error: 'このメールアドレスのアカウントが見つかりません。' }, 404);
  if (target.role !== 'photographer') {
    return jsonResponse({ error: 'カメラマン以外のアカウントは、ここから再発行できません。' }, 403);
  }

  const password = generatePassword();
  try {
    await adminSetPassword(env, target.id, password);
  } catch (err) {
    console.error('photographers/reset-password failed', err);
    return jsonResponse({ error: err.message || 'パスワードの再発行に失敗しました。' }, err.status && err.status < 500 ? err.status : 502);
  }
  return jsonResponse({ id: target.id, email: target.email || email, password });
}
