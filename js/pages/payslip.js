// 報酬明細（撮影月ごと）。カメラマン本人は自分の明細だけ（URLの photographer は無視）、
// 運営は ?photographer=ID で任意のカメラマンの明細を開ける。
//   payslip.html?month=2026-10                    カメラマン本人
//   payslip.html?month=2026-10&photographer=p1    運営（売上管理から）
import { mountLayout } from '../layout.js';
import { getProfile } from '../auth.js';
import { getMyPhotographerRow, getPhotographer, getPhotographerBookings } from '../repo.js';
import { jstDateIso, PHOTOGRAPHER_PAYOUT_RATE, OPTION_PAYOUT_PER_ITEM } from '../data.js';
import { statementFor, ISSUER } from '../payslip.js';
import { recentMonths } from '../sales.js';

mountLayout();

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (n) => `¥${Math.round(n || 0).toLocaleString()}`;
const monthLabel = (m) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;
const md = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '');
const jpDate = (iso) => `${iso.slice(0, 4)}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`;

const params = new URLSearchParams(location.search);
const months = recentMonths(jstDateIso(), 12);
let month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : months[months.length - 1];
if (!months.includes(month)) months.push(month);

function fail(text) {
  document.getElementById('pm-loading').style.display = 'none';
  const el = document.getElementById('ps-error');
  el.textContent = text;
  el.style.display = 'block';
}

function stateCell(s) {
  if (s.key === 'released') return `送金済み${s.date ? `（${md(s.date)}）` : ''}`;
  if (s.key === 'held') return `<span style="color:var(--pm-warn-text)">保留中</span>${s.note ? `<br><span style="color:var(--pm-text-muted)">${esc(s.note)}</span>` : ''}`;
  if (s.key === 'undelivered') return '<span style="color:var(--pm-warn-text)">未納品</span>';
  return `${esc(s.label)}${s.date ? `<br><span style="color:var(--pm-text-muted)">${md(s.date)}頃</span>` : ''}`;
}

function render(photographer, bookings) {
  const st = statementFor(bookings, month);
  const rows = st.rows.map((r) => {
    const b = r.booking;
    const detail = b.status === 'canceled'
      ? `当日キャンセル補償${b.cancel_reason === 'no_show' ? '（遅刻キャンセル）' : ''}`
      : `${esc(b.plan_name)}${b.monitor_application_id ? '（モニター価格）' : ''}<br><span style="color:var(--pm-text-muted)">プラン料金 ${yen(b.plan_price)} × ${Math.round(PHOTOGRAPHER_PAYOUT_RATE * 100)}% ＝ ${yen(r.planPart)}${r.optionCount ? ` ／ オプション ${r.optionCount}件 × ${yen(OPTION_PAYOUT_PER_ITEM)} ＝ ${yen(r.optionPart)}` : ''}</span>`;
    return `<tr><td style="white-space:nowrap">${md(b.booking_date)} ${esc(String(b.start_time).slice(0, 5))}</td><td style="white-space:nowrap">${esc(b.order_number || '—')}</td>
      <td>${esc(b.customer_name || '')} 様</td><td>${detail}</td><td class="num"><b>${yen(r.total)}</b></td><td style="white-space:nowrap">${stateCell(r.state)}</td></tr>`;
  }).join('');
  const box = (label, value, color) => `<div style="flex:1;min-width:150px;border:1px solid var(--pm-border);border-radius:10px;padding:10px 14px"><div style="font:11px var(--pm-font-body);color:var(--pm-text-3)">${label}</div><div style="font:800 20px var(--pm-font-num);${color ? `color:${color}` : ''}">${value}</div></div>`;
  document.getElementById('ps-doc').innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-bottom:18px">
      <div>
        <div style="font:800 22px var(--pm-font-body);letter-spacing:0.08em">報酬明細書</div>
        <div style="font:13px var(--pm-font-body);color:var(--pm-text-3);margin-top:4px">対象：${monthLabel(month)}撮影分</div>
      </div>
      <div style="text-align:right;font:12px/1.8 var(--pm-font-body);color:oklch(0.35 0.02 235)">
        発行日：${jpDate(jstDateIso())}<br>発行元：${ISSUER}
      </div>
    </div>
    <div style="font:700 17px var(--pm-font-body);border-bottom:1.5px solid oklch(0.3 0.02 235);display:inline-block;padding:0 24px 4px 0;margin-bottom:16px">${esc(photographer.name)} 様</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">
      ${box('報酬合計（税込）', yen(st.total))}
      ${box('送金済み', yen(st.released))}
      ${box('未送金', yen(st.unpaid), st.unpaid ? 'var(--pm-warn-text)' : '')}
      ${box('件数', `${st.count}件${st.compCount ? `＋補償${st.compCount}件` : ''}`)}
    </div>
    ${st.rows.length ? `<div style="overflow-x:auto"><table class="ps-table">
      <thead><tr><th>撮影日</th><th>注文番号</th><th>お客様</th><th>内容・計算</th><th class="num">報酬</th><th>状態</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700;padding-top:10px">合計</td><td class="num" style="font-weight:800;padding-top:10px">${yen(st.total)}</td><td></td></tr></tfoot>
    </table></div>` : '<div class="pm-empty" style="margin:8px 0">この月に報酬の対象となる撮影はありません。</div>'}
    <div style="font:11px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin-top:16px;border-top:1px solid var(--pm-border-faint);padding-top:10px">
      ・報酬は「プラン料金の${Math.round(PHOTOGRAPHER_PAYOUT_RATE * 100)}%＋オプション1件につき${yen(OPTION_PAYOUT_PER_ITEM)}」です（モニター価格の予約は、実際のプラン料金の${Math.round(PHOTOGRAPHER_PAYOUT_RATE * 100)}%）。お客様の当日キャンセル・遅刻キャンセルは、補償のみをお支払いします。<br>
      ・お支払いは月末締め・翌月25日に、ご登録の口座へ銀行振込します。対象は、納品済みで撮影日から30日の保証期間が過ぎた予約です。「頃」の日付は目安で、マッチング数保証の申請・送金の保留・未納品があると後になります。<br>
      ・金額は税込です。源泉徴収・インボイスの扱いについては、運営にお問い合わせください。
    </div>`;
}

(async () => {
  const profile = await getProfile();
  if (!profile || !['photographer', 'ops'].includes(profile.role)) {
    location.href = profile ? 'index.html' : 'pro-login.html';
    return;
  }
  let photographer;
  if (profile.role === 'photographer') {
    photographer = await getMyPhotographerRow();
    document.getElementById('ps-back').href = 'admin.html';
  } else {
    const id = params.get('photographer');
    if (!id) { fail('カメラマンが指定されていません。売上管理から開いてください。'); return; }
    photographer = await getPhotographer(id).catch(() => null);
    document.getElementById('ps-back').href = 'ops-sales.html';
  }
  if (!photographer) { fail('カメラマンの情報が見つかりません。'); return; }

  let bookings;
  try {
    bookings = await getPhotographerBookings(photographer.id);
  } catch (err) {
    console.error(err);
    fail('データの取得に失敗しました。');
    return;
  }

  const monthEl = document.getElementById('ps-month');
  monthEl.innerHTML = [...months].sort().reverse().map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  monthEl.value = month;
  monthEl.addEventListener('change', () => {
    month = monthEl.value;
    params.set('month', month);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    render(photographer, bookings);
  });
  document.getElementById('ps-print').addEventListener('click', () => window.print());

  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('ps-wrap').style.display = 'block';
  render(photographer, bookings);
})();
