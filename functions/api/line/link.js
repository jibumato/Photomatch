// POST /api/line/link  { action: 'status' | 'code' | 'unlink' }
// The logged-in photographer's LINE通知 settings (admin.html):
//   status  whether LINE is linked (and whether LINE is set up at all)
//   code    issues a one-time code (30 minutes) to send to the PhotoMatch
//           LINE account; /api/line/webhook links the sender's LINE to them
//   unlink  stops LINE notifications
import { verifyUser, restSelect, restUpsert, restUpdate } from '../../_lib/supabaseAdmin.js';
import { isLineConfigured, lineLinks } from '../../_lib/line.js';

export const LINK_CODE_MINUTES = 30;
// No 0/O/1/I/L, so a code read off the screen can't be mistyped.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PM-${[...bytes].map((x) => ALPHABET[x % ALPHABET.length]).join('')}`;
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const [photographer] = await restSelect(env, 'photographers', { profile_id: `eq.${user.id}`, select: 'id' });
  if (!photographer) return jsonResponse({ error: 'カメラマンのアカウントでログインしてください。' }, 403);

  const configured = isLineConfigured(env);
  const action = payload && payload.action;
  if (action === 'status') {
    const [link] = configured ? await restSelect(env, 'line_links', { photographer_id: `eq.${photographer.id}`, select: '*' }) : [];
    const linked = !!(link && link.active);
    return jsonResponse({
      configured,
      linked,
      linked_at: linked ? link.linked_at : null,
      last_error_at: linked && link.last_error ? link.last_error_at : null,
      add_friend_url: lineLinks(env).addFriendUrl,
    });
  }
  if (!configured) return jsonResponse({ error: 'LINE通知は準備中です。' }, 503);

  if (action === 'code') {
    const code = newCode();
    const expiresAt = new Date(Date.now() + LINK_CODE_MINUTES * 60e3).toISOString();
    // One pending code per photographer: a new one replaces the old.
    await restUpsert(env, 'line_link_codes', { photographer_id: photographer.id, code, expires_at: expiresAt });
    const { addFriendUrl, sendCodeUrl } = lineLinks(env, code);
    return jsonResponse({ code, expires_at: expiresAt, add_friend_url: addFriendUrl, send_code_url: sendCodeUrl });
  }
  if (action === 'unlink') {
    await restUpdate(env, 'line_links', { photographer_id: `eq.${photographer.id}` }, { active: false });
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: '不正なリクエストです。' }, 400);
}
