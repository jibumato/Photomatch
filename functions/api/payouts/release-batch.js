// POST /api/payouts/release-batch  { booking_ids: [...], note }
// ops-only. 「まとめて振込済みにする」: records the payout of several bookings
// (each with the same checks as /api/payouts/release) and emails each
// photographer one summary of what was paid.
import { verifyUser, getProfile, restSelect } from '../../_lib/supabaseAdmin.js';
import { releaseOne, recordWithholding } from '../../_lib/payouts.js';
import { sendEmail } from '../../_lib/email.js';

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
  const ids = Array.isArray(payload && payload.booking_ids) ? [...new Set(payload.booking_ids)].slice(0, 200) : [];
  const note = (payload && payload.note) || null;
  if (!ids.length) return jsonResponse({ error: 'booking_ids が必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const results = [];
  const byPhotographer = {};
  for (const id of ids) {
    try {
      const r = await releaseOne(env, id, note);
      results.push({ booking_id: id, ok: !!r.ok, amount: r.amount || 0, error: r.error || null });
      if (r.ok) (byPhotographer[r.booking.photographer_id] = byPhotographer[r.booking.photographer_id] || []).push(r);
    } catch (err) {
      console.error('release-batch item failed', id, err);
      results.push({ booking_id: id, ok: false, amount: 0, error: '更新に失敗しました。' });
    }
  }

  // 源泉徴収は、カメラマンごとの1回の振込（この記録でまとめて送る分）に対して計算する。
  const transfers = {};
  for (const [photographerId, items] of Object.entries(byPhotographer)) {
    try {
      transfers[photographerId] = await recordWithholding(env, photographerId, items);
    } catch (err) {
      console.error('release-batch: withholding failed', photographerId, err);
      const gross = items.reduce((n, r) => n + r.amount, 0);
      transfers[photographerId] = { gross, withholding: 0, net: gross, failed: true };
    }
  }

  const origin = new URL(request.url).origin;
  for (const [photographerId, items] of Object.entries(byPhotographer)) {
    try {
      const [photographer] = await restSelect(env, 'photographers', { id: `eq.${photographerId}`, select: 'name,profile_id' });
      if (!photographer || !photographer.profile_id) continue;
      const [pro] = await restSelect(env, 'profiles', { id: `eq.${photographer.profile_id}`, select: 'email' });
      if (!pro || !pro.email) continue;
      const total = items.reduce((sum, r) => sum + r.amount, 0);
      const t = transfers[photographerId];
      const taxLines = t.withholding ? `\n源泉徴収税額（所得税及び復興特別所得税）：−¥${t.withholding.toLocaleString()}\nお振込額：¥${t.net.toLocaleString()}` : '';
      const lines = items.map((r) => `・${r.booking.booking_date} ${r.booking.status === 'canceled' ? '当日キャンセル補償' : r.booking.plan_name}　¥${r.amount.toLocaleString()}`).join('\n');
      await sendEmail(env, {
        to: pro.email,
        subject: `【PhotoMatch】報酬をお振り込みしました（¥${t.net.toLocaleString()}）`,
        text: `${photographer.name} さん\n\nいつもありがとうございます。以下の報酬を、ご登録の口座にお振り込みしました（または、お振り込みの手続きをしました）。\n\n${lines}\n\n報酬合計：¥${total.toLocaleString()}（${items.length}件）${taxLines}\n\n明細は管理画面の「報酬」の「明細」からもご確認いただけます。\n${origin}/admin.html\n\n――――――――――\nPhotoMatch\nお問い合わせ：info.photomatch@gmail.com`,
      });
    } catch (err) {
      console.error('release-batch: email failed', photographerId, err);
    }
  }
  return jsonResponse({ ok: true, results, released: results.filter((r) => r.ok).length, transfers });
}
