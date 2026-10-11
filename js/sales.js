// 売上管理（ops-sales.html）の集計ルール。画面から切り離した純粋な関数にして、
// 数字の出し方をテストで確かめられるようにしている。
//
// 考え方（すべて税込）:
//   売上   = お客様から受け取った額 − 返金した額
//            （キャンセル料は、返金しなかった分としてここに入る）
//   原価   = カメラマンへの報酬（photographerPayoutFor：プラン料金の50％＋オプション1件¥1,100、
//            キャンセルは当日補償のみ）
//   粗利   = 売上 − 原価
//   手数料 = Stripe の決済手数料の概算（受け取った額 × STRIPE_FEE_RATE。返金しても戻らない）
//   利益   = 粗利 − 手数料（概算）
//   営業利益 = 利益 − 経費（運営が入力した経費。月は経費の日付で分ける）
// 集計する月は「撮影日」で決める（サービスを提供した日に計上する）。
import { photographerPayoutFor, STRIPE_FEE_RATE, CONSUMPTION_TAX_RATE } from './data.js';

const ACTIVE = ['paid', 'confirmed', 'requested', 'completed'];

// お客様が実際に支払った予約か（決済待ち・決済されないままキャンセルされたものは除く）。
export function wasPaid(b) {
  if (!b || !(b.total_price > 0)) return false;
  if (ACTIVE.includes(b.status)) return true;
  return b.status === 'canceled' && !!(b.stripe_payment_intent_id || b.stripe_charge_id);
}

// 無料の再撮影など、金額がなくてもカメラマンに報酬が出る予約があるので、
// 件数・原価は「支払い済み」と別に数える。
export function isCounted(b) {
  return !!b && (ACTIVE.includes(b.status) || (b.status === 'canceled' && wasPaid(b)));
}

export function bookingFinancials(b) {
  const paid = wasPaid(b) ? b.total_price : 0;
  const refunded = paid ? Math.min(paid, b.refund_amount || 0) : 0;
  const net = paid - refunded;
  const payout = isCounted(b) ? photographerPayoutFor(b) : 0;
  const fee = Math.round(paid * STRIPE_FEE_RATE);
  const canceled = b.status === 'canceled';
  return {
    paid, refunded, net, payout, fee,
    gross: net - payout,
    profit: net - payout - fee,
    // 内訳：キャンセル料収入（キャンセルで返金しなかった分）／通常の売上
    cancelRevenue: canceled ? net : 0,
    serviceRevenue: canceled ? 0 : net,
    planRevenue: canceled ? 0 : Math.max(0, net - (b.options_total || 0)),
    optionRevenue: canceled ? 0 : Math.min(net, b.options_total || 0),
    counted: isCounted(b),
    canceled,
    refundFailed: canceled && ['failed', 'pending'].includes(b.refund_status) && (b.refund_amount || 0) > 0,
  };
}

export const monthOf = (b) => String(b.booking_date).slice(0, 7);

const ZERO = () => ({
  bookings: 0, canceledBookings: 0, paid: 0, refunded: 0, net: 0, payout: 0, gross: 0, fee: 0, profit: 0,
  serviceRevenue: 0, cancelRevenue: 0, planRevenue: 0, optionRevenue: 0,
  payoutPending: 0, payoutReleased: 0, refundFailedCount: 0,
});

export function summarize(list) {
  const t = ZERO();
  for (const b of list) {
    const f = bookingFinancials(b);
    if (!f.counted) continue;
    t.bookings += f.canceled ? 0 : 1;
    t.canceledBookings += f.canceled ? 1 : 0;
    for (const k of ['paid', 'refunded', 'net', 'payout', 'gross', 'fee', 'profit', 'serviceRevenue', 'cancelRevenue', 'planRevenue', 'optionRevenue']) t[k] += f[k];
    if (f.payout > 0) t[b.payout_status === 'released' ? 'payoutReleased' : 'payoutPending'] += f.payout;
    if (f.refundFailed) t.refundFailedCount += 1;
  }
  t.averageOrder = t.bookings ? Math.round(t.serviceRevenue / t.bookings) : 0;
  t.netExTax = Math.round(t.net / (1 + CONSUMPTION_TAX_RATE));
  t.tax = t.net - t.netExTax;
  return t;
}

// 月ごと（"2026-10" の形）に集計した { month, ...summary } を、古い順で返す。
export function byMonth(list, months) {
  const groups = Object.fromEntries(months.map((m) => [m, []]));
  for (const b of list) if (groups[monthOf(b)]) groups[monthOf(b)].push(b);
  return months.map((month) => ({ month, ...summarize(groups[month]) }));
}

// カメラマンごとの集計（売上の多い順）。
export function byPhotographer(list) {
  const groups = new Map();
  for (const b of list) {
    if (!groups.has(b.photographer_id)) groups.set(b.photographer_id, { id: b.photographer_id, name: b.photographer_name || b.photographer_id, rows: [] });
    groups.get(b.photographer_id).rows.push(b);
  }
  return [...groups.values()]
    .map((g) => ({ id: g.id, name: g.name, ...summarize(g.rows) }))
    .filter((g) => g.bookings + g.canceledBookings > 0)
    .sort((a, b) => b.net - a.net);
}

// 直近 count か月（今月を含む）の月キーを古い順に返す。today は "YYYY-MM-DD"（日本時間）。
export function recentMonths(today, count = 12) {
  let [y, m] = today.split('-').map(Number);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  // Cells starting with = + - @ would be run as formulas by Excel.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// その月の予約の明細（経理用）。Excel で文字化けしないよう、呼び出し側で BOM を付けて保存する。
export function bookingsCsv(list) {
  const head = ['注文番号', '撮影日', '開始', 'カメラマン', 'お客様', 'プラン', 'プラン料金', 'オプション料金', '支払額', '返金額', '売上', '報酬', '粗利', '決済手数料(概算)', '状態', '報酬の送金'];
  const label = { paid: '確定', confirmed: '確定', requested: '依頼中', completed: '完了', canceled: 'キャンセル' };
  const rows = list.filter(isCounted).map((b) => {
    const f = bookingFinancials(b);
    return [b.order_number || '', b.booking_date, String(b.start_time || '').slice(0, 5), b.photographer_name || b.photographer_id, b.customer_name || '', b.plan_name || '',
      b.plan_price || 0, b.options_total || 0, f.paid, f.refunded, f.net, f.payout, f.gross, f.fee, label[b.status] || b.status, b.payout_status === 'released' ? '送金済み' : '未送金'];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// 経費の集計（運営が入力。月は expense_date で分ける）。
export const expenseMonthOf = (e) => String(e.expense_date).slice(0, 7);

export function summarizeExpenses(list) {
  const byCategory = {};
  let total = 0;
  for (const e of list) {
    total += e.amount || 0;
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
  }
  return { total, byCategory };
}

export function expensesCsv(list) {
  const head = ['日付', '科目', '金額（税込）', 'メモ'];
  return [head, ...list.map((e) => [e.expense_date, e.category, e.amount, e.memo || ''])].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
