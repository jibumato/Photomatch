// POST /api/photographers/shoot-count  { photographer_id, shoot_count }
// ops-only. Sets the 撮影実績 shown as a badge on the search list and the
// profile (「実績250+」). shoot_count: a whole number, or null to hide the badge.
// Photographers can't set it themselves (it's not in their column grant).
import { verifyUser, getProfile, restUpdate } from '../../_lib/supabaseAdmin.js';

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
  const photographerId = payload && payload.photographer_id;
  const raw = payload ? payload.shoot_count : undefined;
  const count = raw === null || raw === '' ? null : Number(raw);
  if (!photographerId) return jsonResponse({ error: 'photographer_id が必要です。' }, 400);
  if (count !== null && !(Number.isInteger(count) && count >= 0 && count <= 100000)) {
    return jsonResponse({ error: '撮影実績は0以上の整数で入力してください。' }, 400);
  }

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const updated = await restUpdate(env, 'photographers', { id: `eq.${photographerId}` }, { shoot_count: count });
    if (!updated.length) return jsonResponse({ error: 'カメラマンが見つかりません。' }, 404);
    return jsonResponse({ ok: true, shoot_count: updated[0].shoot_count ?? null });
  } catch (err) {
    console.error('shoot-count failed', err);
    if (String(err.message).includes('shoot_count')) {
      return jsonResponse({ error: 'データベースの更新が必要です。Supabase で supabase/schema.sql を実行してから、もう一度保存してください。' }, 500);
    }
    return jsonResponse({ error: '保存に失敗しました。' }, 500);
  }
}
