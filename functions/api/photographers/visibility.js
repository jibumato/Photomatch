// POST /api/photographers/visibility  { photographer_id, visible }
// ops-only. Approves a photographer for listing (visible: true) or takes them
// off the listing (visible: false). This is the ops half of the two-flag
// listing model: is_visible is ops approval, is_paused is the photographer's
// own temporary pause (admin.html). A browser role can't be granted
// is_visible without also letting photographers flip it on their own row, so
// it's written here with service_role after an ops-role check.
//
// Approval requires a complete profile, since it's what backs the
// 「審査済みカメラマン」 badge, and registers the standard plan set when the
// photographer has none (a listing with no plans can't be booked).
import { verifyUser, getProfile, restSelect, restInsert, restUpdate } from '../../_lib/supabaseAdmin.js';
import { AREAS, PRICING_PLANS } from '../../../js/data.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function missingForApproval(p) {
  const missing = [];
  if (!p.photo_url) missing.push('プロフィール写真');
  if (!p.name || !p.name.trim()) missing.push('表示名');
  if (!AREAS.some((a) => a.label === p.area)) missing.push('活動エリア');
  if (!p.gender) missing.push('性別');
  if (!p.bio || !p.bio.trim()) missing.push('紹介文');
  return missing;
}

function standardPlans(photographerId) {
  return PRICING_PLANS.map((pl, i) => ({
    photographer_id: photographerId,
    name: pl.name,
    price: Number(pl.price.replace(/,/g, '')),
    original_price: pl.originalPrice ? Number(pl.originalPrice.replace(/,/g, '')) : null,
    discount_label: pl.discountLabel || null,
    description: pl.desc,
    duration_min: 45,
    sort_order: i,
  }));
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const photographerId = payload && payload.photographer_id;
  const visible = payload && payload.visible;
  if (!photographerId || typeof visible !== 'boolean') return jsonResponse({ error: 'photographer_id と visible が必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const rows = await restSelect(env, 'photographers', { id: `eq.${photographerId}`, select: '*' });
    const photographer = rows[0];
    if (!photographer) return jsonResponse({ error: 'カメラマンが見つかりません。' }, 404);

    let plansAdded = 0;
    if (visible) {
      const missing = missingForApproval(photographer);
      if (missing.length) {
        return jsonResponse({ error: `プロフィールが未入力のため公開できません（${missing.join('・')}）。` }, 400);
      }
      const plans = await restSelect(env, 'plans', { photographer_id: `eq.${photographerId}`, select: 'id' });
      if (!plans.length) {
        await restInsert(env, 'plans', standardPlans(photographerId));
        plansAdded = PRICING_PLANS.length;
      }
    }

    await restUpdate(env, 'photographers', { id: `eq.${photographerId}` }, { is_visible: visible });
    return jsonResponse({ success: true, plansAdded });
  } catch (err) {
    console.error('photographers/visibility failed', err);
    return jsonResponse({ error: '更新に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
