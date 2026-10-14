// POST /api/photographers/settings  { photographer_id, withholding_tax }
// ops-only. Per-photographer settings that photographers can't change
// themselves: withholding_tax — whether 源泉徴収 is deducted from their
// payouts (true for individuals; false e.g. for a corporation).
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
  if (!photographerId || typeof payload.withholding_tax !== 'boolean') {
    return jsonResponse({ error: 'photographer_id と withholding_tax が必要です。' }, 400);
  }
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const updated = await restUpdate(env, 'photographers', { id: `eq.${photographerId}` }, { withholding_tax: payload.withholding_tax });
    if (!updated.length) return jsonResponse({ error: 'カメラマンが見つかりません。' }, 404);
    return jsonResponse({ ok: true, withholding_tax: updated[0].withholding_tax });
  } catch (err) {
    console.error('photographers/settings failed', err);
    if (String(err.message).includes('withholding_tax')) {
      return jsonResponse({ error: 'データベースの更新が必要です。Supabase で supabase/schema.sql を実行してから、もう一度保存してください。' }, 500);
    }
    return jsonResponse({ error: '保存に失敗しました。' }, 500);
  }
}
