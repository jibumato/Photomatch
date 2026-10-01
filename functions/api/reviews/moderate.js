// POST /api/reviews/moderate  { review_id, hidden }
// ops-only. Hides (hidden: true) or restores a customer review. A hidden review
// disappears from the photographer's page and drops out of their rating (the
// reviews_refresh_rating trigger recalculates). It's a Function rather than a
// browser update because the same database role covers every signed-in user:
// granting is_hidden to it would let reviewers un-hide their own review.
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';

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
  const reviewId = payload && payload.review_id;
  const hidden = payload && payload.hidden;
  if (!reviewId || typeof hidden !== 'boolean') return jsonResponse({ error: 'review_id と hidden が必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const rows = await restSelect(env, 'reviews', { id: `eq.${reviewId}`, select: 'id' });
    if (!rows[0]) return jsonResponse({ error: '口コミが見つかりません。' }, 404);
    await restUpdate(env, 'reviews', { id: `eq.${reviewId}` }, { is_hidden: hidden });
    return jsonResponse({ success: true });
  } catch (err) {
    console.error('reviews/moderate failed', err);
    return jsonResponse({ error: '更新に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
