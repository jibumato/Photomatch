// GET /api/status
// ops-only. Reports what the deployed Functions can actually see — which
// environment variables are set and whether the keys are accepted — so a
// missing or mistyped setting shows up on the ops screen instead of as a
// confusing failure later. Returns booleans/labels only, never the values.
//
// Ops is checked with the caller's own token (RLS lets a user read their own
// profile row), not the service key: this endpoint has to keep working when
// the service key is exactly what's missing.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../js/config.js';
import { verifyUser, restSelect } from '../_lib/supabaseAdmin.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function isOps(request, userId) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const rows = await res.json();
  return !!rows[0] && rows[0].role === 'ops';
}

// Can the service key actually read the database? (set but wrong => rejected)
async function checkServiceRole(env, userId) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'missing';
  try {
    await restSelect(env, 'profiles', { id: `eq.${userId}`, select: 'id' });
    return 'ok';
  } catch (e) {
    return 'invalid';
  }
}

// Stripe answers GET /v1/balance for any valid secret key and says which mode
// the key belongs to (livemode), so one call tells valid / test / live apart.
async function checkStripe(env) {
  if (!env.STRIPE_SECRET_KEY) return 'missing';
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    if (!res.ok) return 'invalid';
    const body = await res.json();
    return body.livemode ? 'live' : 'test';
  } catch (e) {
    return 'unreachable';
  }
}

// A sending-only Resend key can't list domains, so "restricted" counts as accepted;
// only an explicit invalid-key reply is reported as invalid.
async function checkResend(env) {
  if (!env.RESEND_API_KEY) return 'missing';
  try {
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
    if (res.ok) return 'ok';
    const body = await res.json().catch(() => ({}));
    return body && body.name === 'invalid_api_key' ? 'invalid' : 'ok';
  } catch (e) {
    return 'unreachable';
  }
}

export async function onRequestGet({ request, env }) {
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  if (!(await isOps(request, user.id))) return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [serviceRole, stripe, resend] = await Promise.all([checkServiceRole(env, user.id), checkStripe(env), checkResend(env)]);
  return jsonResponse({
    ok: true,
    supabase_service_role: serviceRole,
    stripe_secret: stripe,
    stripe_webhook_secret: env.STRIPE_WEBHOOK_SECRET ? 'set' : 'missing',
    resend_key: resend,
    email_from: env.EMAIL_FROM ? 'set' : 'missing',
  });
}
