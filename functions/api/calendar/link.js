// POST /api/calendar/link  { action: 'status' | 'create' | 'reset' | 'delete' }
// The logged-in photographer's カレンダー連携 (admin.html):
//   status  the current calendar URL, if any (and when a calendar app last read it)
//   create  issues the URL (or returns the existing one)
//   reset   issues a new URL; the old one stops working at once
//   delete  stops the calendar URL
// The URL is served by functions/api/calendar/feed/[token].js.
import { verifyUser, restSelect, restUpsert, restDelete } from '../../_lib/supabaseAdmin.js';

const SCHEMA_HINT = 'データベースの更新が必要です。Supabase で supabase/schema.sql を実行してから、もう一度お試しください。';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// 32 random bytes, base64url (43 characters).
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function feedUrls(origin, token) {
  const url = `${origin}/api/calendar/feed/${token}.ics`;
  const webcal = url.replace(/^https?:/, 'webcal:');
  return {
    url,
    webcal_url: webcal,
    // Opens Google Calendar's 「カレンダーを追加」 with this URL filled in.
    google_url: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}

const describe = (origin, row) => (row
  ? { enabled: true, ...feedUrls(origin, row.token), created_at: row.created_at, last_fetched_at: row.last_fetched_at || null }
  : { enabled: false });

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

  const origin = new URL(request.url).origin;
  const action = payload && payload.action;
  const match = { photographer_id: `eq.${photographer.id}`, select: '*' };
  try {
    const [current] = await restSelect(env, 'calendar_feeds', match);
    if (action === 'status') return jsonResponse(describe(origin, current));
    if (action === 'create' && current) return jsonResponse(describe(origin, current));
    if (action === 'create' || action === 'reset') {
      const [row] = await restUpsert(env, 'calendar_feeds', {
        photographer_id: photographer.id, token: newToken(), created_at: new Date().toISOString(), last_fetched_at: null,
      });
      return jsonResponse(describe(origin, row));
    }
    if (action === 'delete') {
      await restDelete(env, 'calendar_feeds', { photographer_id: `eq.${photographer.id}` });
      return jsonResponse({ enabled: false });
    }
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  } catch (err) {
    console.error('calendar/link failed', err);
    if (/calendar_feeds/.test(String(err.message))) return jsonResponse({ error: SCHEMA_HINT }, 500);
    return jsonResponse({ error: 'カレンダー連携の処理に失敗しました。' }, 500);
  }
}
