// Recording a photographer payout (the money itself goes by bank transfer,
// done by ops). Shared by /api/payouts/release (one booking) and
// /api/payouts/release-batch (the 「まとめて振込済みにする」 button).
import { addDaysToIso, GUARANTEE_WINDOW_DAYS, guaranteeBlocksPayout, guaranteeClaimDeadline, photographerPayoutFor } from '../../js/data.js';
import { restSelect, restUpdate } from './supabaseAdmin.js';

// Resolves to { ok: true, amount, booking } or { error, status }.
export async function releaseOne(env, bookingId, note) {
  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return { error: '予約が見つかりません。', status: 404 };
  // A canceled booking is only paid out when it carries a same-day
  // cancellation compensation; there's no shoot, so no guarantee window.
  const compensation = booking.status === 'canceled' && booking.photographer_cancel_comp > 0;
  if (booking.status !== 'paid' && !compensation) {
    return { error: booking.status === 'canceled' ? 'このキャンセルにはカメラマンへの支払いがありません。' : 'この予約はまだ決済が完了していません。', status: 400 };
  }
  if (booking.payout_status === 'released') return { error: 'この予約はすでに送金済みです。', status: 400 };
  if (booking.payout_hold) return { error: `この予約の送金は保留中です（${booking.payout_hold_reason || '理由未記入'}）。確認してから、運営画面「予約の管理」で保留を解除してください。`, status: 400 };
  const amount = photographerPayoutFor(booking);
  if (!amount) return { error: '報酬のない予約です（無料再撮影など）。', status: 400 };

  if (!compensation) {
    if (!booking.delivered_at) return { error: 'まだ納品されていない予約です（カメラマンが「納品する」を押すと送金できます）。', status: 400 };
    const eligibleDate = new Date(`${booking.booking_date}T00:00:00+09:00`);
    eligibleDate.setDate(eligibleDate.getDate() + GUARANTEE_WINDOW_DAYS);
    if (new Date() < eligibleDate) {
      return { error: `保証期間中のため送金確定できません（${addDaysToIso(booking.booking_date, GUARANTEE_WINDOW_DAYS)}以降に送金可能）。`, status: 400 };
    }
    const claims = await restSelect(env, 'guarantee_claims', { booking_id: `eq.${bookingId}`, select: 'status,eligible_at' });
    const blocking = claims.find((c) => guaranteeBlocksPayout(c));
    if (blocking) {
      return {
        error: blocking.status === 'claimed'
          ? '再撮影申請が審査中のため送金確定できません。先に保証審査を完了してください。'
          : `マッチング数保証の申請期限（${guaranteeClaimDeadline(blocking)}）までは送金確定できません。`,
        status: 400,
      };
    }
  }

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
