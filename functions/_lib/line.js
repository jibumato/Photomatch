// LINE notifications to photographers, via the LINE Messaging API of the
// PhotoMatch LINE公式アカウント. Optional: with no LINE_CHANNEL_ACCESS_TOKEN set,
// everything here is a no-op and email stays the only channel.
//
// Env:
//   LINE_CHANNEL_ACCESS_TOKEN  long-lived channel access token
//   LINE_CHANNEL_SECRET        verifies webhook signatures
//   LINE_BOT_BASIC_ID          the account's ID, e.g. "@123abcde" (for the
//                              友だち追加 / message links shown to photographers)
//
// A photographer links their LINE once from admin.html (a one-time code they
// send to the account, see /api/line/link and /api/line/webhook); the LINE
// user id is kept in line_links.
import { restSelect, restUpdate } from './supabaseAdmin.js';

const API = 'https://api.line.me/v2/bot/message';

export const isLineConfigured = (env) => !!(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET);

async function lineCall(env, path, body, retryKey) {
  const headers = { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
  // Lets LINE drop a duplicate if the same push is retried.
  if (retryKey) headers['X-Line-Retry-Key'] = retryKey;
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok && res.status !== 409) throw new Error(`LINE ${path} ${res.status}: ${await res.text()}`);
}

export function lineReply(env, replyToken, messages) {
  // Replies to a user's own message are free (don't count toward the monthly limit).
  return lineCall(env, 'reply', { replyToken, messages });
}

// base64(HMAC-SHA256(channel secret, raw body)) must equal X-Line-Signature.
export async function verifyLineSignature(env, rawBody, signature) {
  if (!env.LINE_CHANNEL_SECRET || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(env.LINE_CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
  let bin = '';
  sig.forEach((x) => { bin += String.fromCharCode(x); });
  const expected = btoa(bin);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// LINE caps text lengths; cut rather than have the whole push rejected.
export const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

// Sends to the photographer's linked LINE, if any. Never throws (email is the
// primary channel); a failure is recorded on the link for ops to see.
export async function pushToPhotographer(env, photographerId, messages, retryKey) {
  if (!isLineConfigured(env) || !photographerId) return false;
  try {
    const [link] = await restSelect(env, 'line_links', { photographer_id: `eq.${photographerId}`, active: 'eq.true', select: 'photographer_id,line_user_id' });
    if (!link) return false;
    try {
      await lineCall(env, 'push', { to: link.line_user_id, messages }, retryKey);
      await restUpdate(env, 'line_links', { photographer_id: `eq.${photographerId}` }, { last_sent_at: new Date().toISOString(), last_error: null });
      return true;
    } catch (err) {
      console.error('LINE push failed', err);
      await restUpdate(env, 'line_links', { photographer_id: `eq.${photographerId}` }, { last_error: clip(err.message, 300), last_error_at: new Date().toISOString() });
      return false;
    }
  } catch (err) {
    console.error('pushToPhotographer failed', err);
    return false;
  }
}

// Friend-add and "open a chat with this text" links for the LINE account.
export function lineLinks(env, text) {
  const id = env.LINE_BOT_BASIC_ID ? (env.LINE_BOT_BASIC_ID.startsWith('@') ? env.LINE_BOT_BASIC_ID : `@${env.LINE_BOT_BASIC_ID}`) : '';
  if (!id) return { addFriendUrl: null, sendCodeUrl: null };
  return {
    addFriendUrl: `https://line.me/R/ti/p/${encodeURIComponent(id)}`,
    sendCodeUrl: text ? `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(text)}` : null,
  };
}
