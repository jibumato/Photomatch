// Recording a photographer payout (the money itself goes by bank transfer,
// done by ops). Shared by /api/payouts/release (one booking) and
// /api/payouts/release-batch (the 「まとめて振込済みにする」 button).
import { photographerPayoutFor, withholdingTaxFor, allocateWithholding } from '../../js/data.js';
import { restSelect, restUpdate } from './supabaseAdmin.js';

// Resolves to { ok: true, amount, booking } or { error, status }.
export async function releaseOne(env, bookingId, note) {
  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return { error: '予約が見つかりません。', status: 404 };
  // A canceled booking is only paid out when it carries a same-day
  // cancellation compensation; there's no shoot, so nothing to deliver.
  const compensation = booking.status === 'canceled' && booking.photographer_cancel_comp > 0;
  if (booking.status !== 'paid' && !compensation) {
    return { error: booking.status === 'canceled' ? 'このキャンセルにはカメラマンへの支払いがありません。' : 'この予約はまだ決済が完了していません。', status: 400 };
  }
  if (booking.payout_status === 'released') return { error: 'この予約はすでに送金済みです。', status: 400 };
  if (booking.payout_hold) return { error: `この予約の送金は保留中です（${booking.payout_hold_reason || '理由未記入'}）。確認してから、運営画面「予約の管理」で保留を解除してください。`, status: 400 };
  const amount = photographerPayoutFor(booking);
  if (!amount) return { error: '報酬のない予約です（無料再撮影など）。', status: 400 };

  // 納品月末締め・翌月25日払い（js/data.js の payoutBasisDate）。送金できるのは納品済みの
  // 撮影から。マッチング数保証の申請では止めない（承認しても元の撮影の報酬は払うため）。
  if (!compensation && !booking.delivered_at) return { error: 'まだ納品されていない予約です（カメラマンが「納品する」を押すと送金できます）。', status: 400 };

  const [bank] = await restSelect(env, 'photographer_bank_accounts', { photographer_id: `eq.${booking.photographer_id}`, select: 'id' });
  if (!bank) return { error: 'カメラマンの振込先口座がまだ登録されていません。', status: 400 };

  // Conditional, so a double click (or a hold set a moment ago) can't record
  // the same payout twice or release a held one.
  const updated = await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, payout_status: 'eq.pending', payout_hold: 'eq.false' }, {
    payout_status: 'released',
    payout_released_at: new Date().toISOString(),
    payout_note: note,
  });
  if (!updated.length) return { error: 'この予約は送金済みか、保留中です。画面を読み込み直してください。', status: 409 };
  return { ok: true, amount, booking };
}

// 1回の振込（同じカメラマンの、同時に記録した予約）について源泉徴収額を計算し、予約ごとに
// 割り振って bookings.payout_withholding に記録する。items: releaseOne の成功結果の配列。
// 返り値 { gross, withholding, net }（net＝実際に振り込む額）。
export async function recordWithholding(env, photographerId, items) {
  const gross = items.reduce((n, r) => n + r.amount, 0);
  const [photographer] = await restSelect(env, 'photographers', { id: `eq.${photographerId}`, select: 'withholding_tax' });
  const applies = !photographer || photographer.withholding_tax !== false;
  const withholding = applies ? withholdingTaxFor(gross) : 0;
  const shares = allocateWithholding(items.map((r) => r.amount), withholding);
  for (let i = 0; i < items.length; i++) {
    await restUpdate(env, 'bookings', { id: `eq.${items[i].booking.id}` }, { payout_withholding: shares[i] });
    items[i].withholding = shares[i];
  }
  return { gross, withholding, net: gross - withholding };
}

