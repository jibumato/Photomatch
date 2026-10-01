// POST /api/photographers/create  { name, email }
// ops-only. Creates a confirmed login account for a new photographer and
// hands the generated temp password back to ops to pass along — this is the
// "ops creates the account and hands it over" flow, as an alternative to the
// photographer self-registering at pro-login.html. The auth insert trigger
// (handle_new_user, see schema.sql) auto-creates the matching profiles row
// and a stub photographers row (id = profile_id = this user's uid). The stub
// is immediately hidden from search/profile pages since its profile fields
// (area/photo/bio/plans) are still empty — ops flips is_visible back on once
// the listing is filled in, same as the "参加未定で一時非表示" pattern.
import { verifyUser, getProfile, adminCreateUser, restUpdate } from '../../_lib/supabaseAdmin.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 14);
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const name = ((payload && payload.name) || '').trim();
  const email = ((payload && payload.email) || '').trim();
  if (!name) return jsonResponse({ error: '名前が必要です。' }, 400);
  if (!email) return jsonResponse({ error: 'メールアドレスが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const password = generatePassword();
  let created;
  try {
    created = await adminCreateUser(env, { email, password, metadata: { role: 'photographer', name } });
  } catch (err) {
    console.error('photographers/create failed', err);
    const message = /registered|exists/i.test(err.message) ? 'このメールアドレスはすでに登録されています。' : (err.message || 'アカウント作成に失敗しました。');
    return jsonResponse({ error: message }, err.status && err.status < 500 ? err.status : 502);
  }

  try {
    await restUpdate(env, 'photographers', { id: `eq.${created.id}` }, { is_visible: false });
  } catch (err) {
    console.error('photographers/create: failed to hide stub row', err);
  }

  return jsonResponse({ id: created.id, email, password });
}
