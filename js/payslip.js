// カメラマンの報酬明細（payslip.html）の作り方。カメラマン本人の管理画面と、運営の
// 売上管理の両方から同じ明細を開くので、計算はここにまとめてテストする。
// 明細の単位は「撮影月」（管理画面の「報酬」・売上管理と同じ）。
//
// 報酬の内訳は photographerPayoutFor（js/data.js）と同じルール：
//   プラン料金 × 50%（モニター価格は実際のプラン料金の50%）＋ オプション1件 ¥1,500、
//   キャンセルは当日キャンセル・遅刻キャンセルの補償（¥2,000）のみ。
// 支払予定日は「納品月末締め・翌月25日払い」：納品した月の翌月25日、当日キャンセルの補償は
// 撮影月の翌月25日（payoutBasisDate）。撮影前は納品期限の月の翌月25日を目安として出す。
// 送金の保留・未納品があると、後になる。
import {
  photographerPayoutFor, PHOTOGRAPHER_PAYOUT_RATE, OPTION_PAYOUT_PER_ITEM, payoutBasisDate, deliveryDueDate, jstDateIso,
  withholdingTaxFor, allocateWithholding, recordedOrEstimatedTaxDeduction,
} from './data.js';

export const ISSUER = 'PhotoMatch運営事務局';

// 撮影月 "YYYY-MM" の翌月25日など、日付 "YYYY-MM-DD" の翌月25日。
export function nextMonth25(iso) {
  let [y, m] = iso.split('-').map(Number);
  m += 1;
  if (m === 13) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}-25`;
}

export function payoutBreakdown(b) {
  if (b.status === 'canceled') {
    const comp = b.photographer_cancel_comp || 0;
    return { planPart: 0, optionCount: 0, optionPart: 0, comp, total: comp };
  }
  const planPart = Math.round((b.plan_price || 0) * PHOTOGRAPHER_PAYOUT_RATE);
  const optionCount = (b.options || []).length;
  const optionPart = OPTION_PAYOUT_PER_ITEM * optionCount;
  return { planPart, optionCount, optionPart, comp: 0, total: planPart + optionPart };
}

// 明細の1行の状態：送金済み／保留中／未納品／撮影前／支払予定。
export function payoutState(b, today = jstDateIso()) {
  if (b.payout_status === 'released') return { key: 'released', label: '送金済み', date: b.payout_released_at ? jstDateIso(new Date(b.payout_released_at)) : null };
  if (b.payout_hold) return { key: 'held', label: '保留中', note: b.payout_hold_reason || '' };
  if (b.status === 'canceled') return { key: 'scheduled', label: '支払予定', date: nextMonth25(payoutBasisDate(b)) };
  if (b.booking_date > today) return { key: 'before', label: '撮影前', date: nextMonth25(deliveryDueDate(b).date) };
  if (!b.delivered_at) return { key: 'undelivered', label: '未納品', note: '納品すると、納品した月の翌月25日に支払います' };
  return { key: 'scheduled', label: '支払予定', date: nextMonth25(payoutBasisDate(b)) };
}

// その月（撮影月）に報酬・補償が出る予約の明細。決済待ち・報酬0円（無料の再撮影、
// 補償のないキャンセル）は載せない。
// 源泉徴収：送金済みの行は、送金時に記録した額（payout_withholding）。未送金の行は、
// 未送金分をまとめて1回で振り込むとした場合の見込み額を割り振る（withholdingApplies が
// false のカメラマン〈法人など〉は0円）。
// 消費税相当額の控除（インボイス未登録の人）：送金済みは記録した額（payout_tax_deduction）、
// 未送金は photographer の今の設定での見込み。源泉徴収は控除後の額を基準にする。
export function statementFor(bookings, month, today = jstDateIso(), { withholdingApplies = true, photographer = null } = {}) {
  const rows = bookings
    .filter((b) => String(b.booking_date).slice(0, 7) === month && b.status !== 'pending_payment' && photographerPayoutFor(b) > 0)
    .sort((a, b) => (a.booking_date + a.start_time < b.booking_date + b.start_time ? -1 : 1))
    .map((b) => ({ booking: b, ...payoutBreakdown(b), state: payoutState(b, today) }));
  rows.forEach((r) => { r.taxDeduction = recordedOrEstimatedTaxDeduction(r.booking, photographer); });
  const unpaidRows = rows.filter((r) => r.state.key !== 'released');
  const unpaidBase = unpaidRows.reduce((n, r) => n + r.total - r.taxDeduction, 0);
  const estimate = withholdingApplies ? withholdingTaxFor(unpaidBase) : 0;
  const shares = allocateWithholding(unpaidRows.map((r) => r.total - r.taxDeduction), estimate);
  unpaidRows.forEach((r, i) => { r.withholding = shares[i]; r.withholdingEstimated = true; });
  rows.forEach((r) => { if (r.state.key === 'released') r.withholding = r.booking.payout_withholding || 0; });
  const sum = (pred) => rows.filter(pred).reduce((n, r) => n + r.total, 0);
  const withholding = rows.reduce((n, r) => n + r.withholding, 0);
  const taxDeduction = rows.reduce((n, r) => n + r.taxDeduction, 0);
  return {
    withholding,
    taxDeduction,
    net: rows.reduce((n, r) => n + r.total, 0) - taxDeduction - withholding,
    withholdingApplies,
    month,
    rows,
    total: sum(() => true),
    released: sum((r) => r.state.key === 'released'),
    unpaid: sum((r) => r.state.key !== 'released'),
    held: sum((r) => r.state.key === 'held'),
    count: rows.filter((r) => r.booking.status !== 'canceled').length,
    compCount: rows.filter((r) => r.booking.status === 'canceled').length,
  };
}
