// Supabase REST helpers for Cloudflare Pages Functions.
//
// SUPABASE_URL / SUPABASE_ANON_KEY are public values, so we import the same
// constants the browser uses instead of duplicating them as env vars.
// SUPABASE_SERVICE_ROLE_KEY bypasses RLS — it must only ever be read from
// env (a Cloudflare Pages secret) and never sent to the client.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../js/config.js';

// Resolves the signed-in user from a request's `Authorization: Bearer <token>`
// header by asking Supabase's GoTrue service to validate it. Returns null if
// missing/invalid — never throws, so callers can respond 401 uniformly.
export async function verifyUser(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json(); // { id, email, ... }
}

function serviceHeaders(env, extra) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

// service_role-authenticated PostgREST calls — bypass RLS entirely, so every
// caller is responsible for its own authorization checks before using these.
export async function restSelect(env, table, query) {
  const params = new URLSearchParams(query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    headers: serviceHeaders(env),
  });
  if (!res.ok) throw new Error(`Supabase select failed on ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function restInsert(env, table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase insert failed on ${table}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

export async function restUpdate(env, table, match, patch) {
  const params = new URLSearchParams(match);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase update failed on ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getProfile(env, userId) {
  const rows = await restSelect(env, 'profiles', { id: `eq.${userId}`, select: '*' });
  return rows[0] || null;
}

export async function getMyPhotographerRow(env, userId) {
  const rows = await restSelect(env, 'photographers', { profile_id: `eq.${userId}`, select: '*' });
  return rows[0] || null;
}
