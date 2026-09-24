// POST /api/connect/onboard
// Creates (or reuses) a Stripe Express connected account for the signed-in
// photographer and returns a Stripe-hosted onboarding link to redirect to.
import { verifyUser, getProfile, getMyPhotographerRow, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'photographer') return jsonResponse({ error: 'カメラマンアカウントでログインしてください。' }, 403);

  const photographerRow = await getMyPhotographerRow(env, user.id);
  if (!photographerRow) {
    return jsonResponse({ error: 'カメラマンプロフィールがまだ設定されていません。運営にお問い合わせください。' }, 404);
  }

  let accountId = photographerRow.stripe_account_id;
  try {
    if (!accountId) {
      const account = await stripe.accounts.create(env, {
        type: 'express',
        country: 'JP',
        email: user.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await restUpdate(env, 'photographers', { id: `eq.${photographerRow.id}` }, { stripe_account_id: accountId });
    }

    const origin = new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create(env, {
      account: accountId,
      refresh_url: `${origin}/admin.html?stripe_return=1`,
      return_url: `${origin}/admin.html?stripe_return=1`,
      type: 'account_onboarding',
    });
    return jsonResponse({ url: accountLink.url });
  } catch (err) {
    console.error('connect/onboard failed', err);
    return jsonResponse({ error: 'Stripeの受け取り設定の開始に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
