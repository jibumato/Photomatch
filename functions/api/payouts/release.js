// POST /api/payouts/release  { booking_id }
// ops-only. Transfers the photographer's share (PHOTOGRAPHER_PAYOUT_RATE) of
// a paid booking's total to their connected Stripe account. This is the
// manual "hold funds, then release after the guarantee window" step chosen
// over instant destination-charge splitting, so a re-shoot dispute never
// requires clawing money back from the photographer.
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';
import { PHOTOGRAPHER_PAYOUT_RATE } from '../../_lib/pricing.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const GUARANTEE_WINDOW_DAYS = 30;

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const bookingId = payload && payload.booking_id;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const bookings = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  const booking = bookings[0];
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (booking.status !== 'paid') return jsonResponse({ error: 'この予約はまだ決済が完了していません。' }, 400);
  if (booking.payout_status === 'released') return jsonResponse({ error: 'この予約はすでに送金済みです。' }, 400);
  if (!booking.stripe_charge_id) return jsonResponse({ error: '決済情報が見つかりません。' }, 400);

  const eligibleDate = new Date(`${booking.booking_date}T00:00:00`);
  eligibleDate.setDate(eligibleDate.getDate() + GUARANTEE_WINDOW_DAYS);
  if (new Date() < eligibleDate) {
    return jsonResponse({ error: `保証期間中のため送金できません（${eligibleDate.toISOString().slice(0, 10)}以降に送金可能）。` }, 400);
  }

  const claims = await restSelect(env, 'guarantee_claims', { booking_id: `eq.${bookingId}`, select: 'status' });
  if (claims.some((c) => c.status === 'claimed')) {
    return jsonResponse({ error: '再撮影申請が審査中のため送金できません。先に保証審査を完了してください。' }, 400);
  }

  const photographers = await restSelect(env, 'photographers', { id: `eq.${booking.photographer_id}`, select: '*' });
  const photographer = photographers[0];
  if (!photographer || !photographer.stripe_account_id || !photographer.stripe_payouts_enabled) {
    return jsonResponse({ error: 'カメラマンのStripe受け取り設定が完了していません。' }, 400);
  }

  const amount = Math.round(booking.total_price * PHOTOGRAPHER_PAYOUT_RATE);
  try {
    const transfer = await stripe.transfers.create(env, {
      amount,
      currency: 'jpy',
      destination: photographer.stripe_account_id,
      source_transaction: booking.stripe_charge_id,
      metadata: { booking_id: bookingId },
    });
    await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, {
      payout_status: 'released',
      stripe_transfer_id: transfer.id,
      payout_released_at: new Date().toISOString(),
    });
    return jsonResponse({ success: true, transfer_id: transfer.id, amount });
  } catch (err) {
    console.error('payouts/release failed', err);
    return jsonResponse({ error: '送金に失敗しました。Stripe側の状態をご確認ください。' }, 502);
  }
}
