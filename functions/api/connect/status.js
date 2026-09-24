// GET /api/connect/status
// Returns the signed-in photographer's current Stripe Connect onboarding
// state, refreshing the cached flags on `photographers` from Stripe.
import { verifyUser, getProfile, getMyPhotographerRow, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet({ request, env }) {
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'photographer') return jsonResponse({ error: 'カメラマンアカウントでログインしてください。' }, 403);

  const photographerRow = await getMyPhotographerRow(env, user.id);
  if (!photographerRow) return jsonResponse({ error: 'カメラマンプロフィールがまだ設定されていません。' }, 404);

  if (!photographerRow.stripe_account_id) {
    return jsonResponse({ connected: false, charges_enabled: false, payouts_enabled: false });
  }

  try {
    const account = await stripe.accounts.retrieve(env, photographerRow.stripe_account_id);
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;
    await restUpdate(env, 'photographers', { id: `eq.${photographerRow.id}` }, {
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
    });
    return jsonResponse({ connected: true, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled });
  } catch (err) {
    console.error('connect/status failed', err);
    return jsonResponse({ error: 'Stripeの状態取得に失敗しました。' }, 502);
  }
}
