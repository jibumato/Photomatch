// POST /api/photographers/settings
//   { photographer_id, withholding_tax?, invoice_number?, tax_deduction_from? }
// ops-only. Per-photographer settings that photographers can't change
// themselves (send only the fields to change):
//   withholding_tax    — whether 源泉徴収 is deducted from their payouts
//                        (true for individuals; false e.g. for a corporation).
//   invoice_number     — インボイスの登録番号（T＋13桁）。'' / null で未登録に戻す。
//   tax_deduction_from — インボイス未登録の人から消費税相当額を差し引き始める撮影日
//                        （YYYY-MM-DD。本人と合意した日）。'' / null で差し引かない。
import { verifyUser, getProfile, restUpdate } from '../../_lib/supabaseAdmin.js';
import { INVOICE_NUMBER_RE } from '../../../js/data.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const photographerId = payload && payload.photographer_id;
  const fields = {};
  if (payload && 'withholding_tax' in payload) {
    if (typeof payload.withholding_tax !== 'boolean') return jsonResponse({ error: 'withholding_tax は true / false で指定してください。' }, 400);
    fields.withholding_tax = payload.withholding_tax;
  }
  if (payload && 'invoice_number' in payload) {
    const v = String(payload.invoice_number || '').trim().toUpperCase().replace(/[-\s]/g, '');
    if (v && !INVOICE_NUMBER_RE.test(v)) return jsonResponse({ error: '登録番号は「T」と13桁の数字で入力してください（例：T1234567890123）。' }, 400);
    fields.invoice_number = v || null;
  }
  if (payload && 'tax_deduction_from' in payload) {
    const v = String(payload.tax_deduction_from || '').trim();
    if (v && !(DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)))) return jsonResponse({ error: '差し引きを始める撮影日の形式が正しくありません。' }, 400);
    fields.tax_deduction_from = v || null;
  }
  if (!photographerId || !Object.keys(fields).length) {
    return jsonResponse({ error: 'photographer_id と、変更する項目が必要です。' }, 400);
  }
  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const updated = await restUpdate(env, 'photographers', { id: `eq.${photographerId}` }, fields);
    if (!updated.length) return jsonResponse({ error: 'カメラマンが見つかりません。' }, 404);
    const row = updated[0];
    return jsonResponse({ ok: true, withholding_tax: row.withholding_tax, invoice_number: row.invoice_number ?? null, tax_deduction_from: row.tax_deduction_from ?? null });
  } catch (err) {
    console.error('photographers/settings failed', err);
    if (/withholding_tax|invoice_number|tax_deduction_from/.test(String(err.message))) {
      return jsonResponse({ error: 'データベースの更新が必要です。Supabase で supabase/schema.sql を実行してから、もう一度保存してください。' }, 500);
    }
    return jsonResponse({ error: '保存に失敗しました。' }, 500);
  }
}
