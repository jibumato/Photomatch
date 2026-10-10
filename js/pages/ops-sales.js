import { mountLayout } from '../layout.js';
import { requireRole, signOut } from '../auth.js';
import { getBookingsForSales } from '../repo.js';
import { jstDateIso } from '../data.js';
import { summarize, byMonth, byPhotographer, recentMonths, monthOf, bookingFinancials, isCounted, bookingsCsv } from '../sales.js';

mountLayout();

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (n) => `${n < 0 ? '−' : ''}¥${Math.abs(Math.round(n || 0)).toLocaleString()}`;
const monthLabel = (m) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;

const months = recentMonths(jstDateIso(), 12);
const state = { all: [], month: months[months.length - 1], scope: 'all' };

const inScope = (b) => state.scope === 'all' || b.photographer_id === state.scope;
const monthRows = () => state.all.filter((b) => inScope(b) && monthOf(b) === state.month);

function card(label, value, sub, tone) {
  const color = tone === 'warn' ? 'var(--pm-warn-text)' : 'oklch(0.3 0.02 235)';
  return `<div class="pm-card" style="padding:14px 18px">
    <div style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${label}</div>
    <div style="font:800 24px var(--pm-font-num);color:${color};margin-top:2px">${value}</div>
    ${sub ? `<div style="font:11px var(--pm-font-body);color:var(--pm-text-muted);margin-top:2px">${sub}</div>` : ''}
  </div>`;
}

function renderSummary() {
  const rows = monthRows();
  const s = summarize(rows);
  document.getElementById('sales-warning').innerHTML = s.refundFailedCount
    ? `<div class="pm-card" style="padding:12px 16px;margin-bottom:12px;border-color:var(--pm-warn-text)"><b style="color:var(--pm-warn-text)">返金が完了していない予約が${s.refundFailedCount}件あります。</b>
       <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">返金額は「返金」に含めて計算しています。運営管理の「予約の管理」で対応してください。</span></div>` : '';
  document.getElementById('sales-kpis').innerHTML = [
    card('売上（税込）', yen(s.net), `税抜 ${yen(s.netExTax)}（消費税 ${yen(s.tax)}）`),
    card('粗利', yen(s.gross), '売上 − カメラマン報酬'),
    card('利益（概算）', yen(s.profit), `Stripe手数料 約${yen(s.fee)} を引いた額`),
    card('予約件数', `${s.bookings}件`, s.canceledBookings ? `ほかにキャンセル ${s.canceledBookings}件` : '', ''),
    card('平均単価', yen(s.averageOrder), '通常の予約の売上÷件数'),
  ].join('');
  const payoutNote = s.payoutPending + s.payoutReleased
    ? `送金済み ${yen(s.payoutReleased)} ／ 未送金 <b style="color:${s.payoutPending ? 'var(--pm-warn-text)' : 'inherit'}">${yen(s.payoutPending)}</b>` : '—';
  const item = (k, v) => `<div style="min-width:170px"><div style="font:11px var(--pm-font-body);color:var(--pm-text-muted)">${k}</div><div style="font:700 15px var(--pm-font-num)">${v}</div></div>`;
  document.getElementById('sales-breakdown').innerHTML = `<div style="display:flex;gap:18px 28px;flex-wrap:wrap;font:13px var(--pm-font-body)">
    ${item('プラン売上', yen(s.planRevenue))}${item('オプション売上', yen(s.optionRevenue))}${item('キャンセル料収入', yen(s.cancelRevenue))}
    ${item('お客様からの入金', yen(s.paid))}${item('返金', yen(s.refunded))}
    ${item('カメラマン報酬', yen(s.payout))}${item('報酬の送金', payoutNote)}</div>`;
}

function renderDetail() {
  const title = document.getElementById('sales-detail-title');
  const el = document.getElementById('sales-detail');
  const rows = monthRows();
  if (state.scope === 'all') {
    title.textContent = `${monthLabel(state.month)}のカメラマン別`;
    const list = byPhotographer(rows);
    el.innerHTML = list.length ? table(['カメラマン', '件数', '売上', '報酬', '粗利', '未送金の報酬'],
      list.map((g) => [`<a href="#" class="scope-link" data-id="${esc(g.id)}" style="color:oklch(0.45 0.14 210);font-weight:700">${esc(g.name)}</a>`,
        `${g.bookings}${g.canceledBookings ? `<span style="color:var(--pm-text-muted)">（＋キャンセル${g.canceledBookings}）</span>` : ''}`, yen(g.net), yen(g.payout), yen(g.gross), g.payoutPending ? `<b style="color:var(--pm-warn-text)">${yen(g.payoutPending)}</b>` : '—']),
      [1, 2, 3, 4, 5]) : '<div class="pm-empty">この月の予約はありません。</div>';
    el.querySelectorAll('.scope-link').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setScope(a.dataset.id); }));
  } else {
    const name = (state.all.find((b) => b.photographer_id === state.scope) || {}).photographer_name || '';
    title.textContent = `${monthLabel(state.month)}の${name}さんの予約`;
    const list = rows.filter(isCounted);
    el.innerHTML = list.length ? table(['撮影日', '注文番号', 'お客様', 'プラン', '売上', '報酬', '粗利', '状態'],
      list.map((b) => {
        const f = bookingFinancials(b);
        return [`${esc(b.booking_date.slice(5))} ${esc(String(b.start_time).slice(0, 5))}`, esc(b.order_number || '—'), esc(b.customer_name || '—'), esc(b.plan_name || ''),
          yen(f.net), yen(f.payout), yen(f.gross),
          f.canceled ? '<span style="color:var(--pm-text-muted)">キャンセル</span>' : (b.payout_status === 'released' ? '送金済み' : '<span style="color:var(--pm-warn-text)">未送金</span>')];
      }), [4, 5, 6]) : '<div class="pm-empty">この月の予約はありません。</div>';
  }
}

function table(head, rows, rightCols) {
  const right = new Set(rightCols);
  const th = head.map((h, i) => `<th style="text-align:${right.has(i) ? 'right' : 'left'};padding:8px 10px;font:700 11px var(--pm-font-body);color:var(--pm-text-3);white-space:nowrap">${h}</th>`).join('');
  const tr = rows.map((r) => `<tr style="border-top:1px solid var(--pm-border-faint)">${r.map((c, i) => `<td style="padding:9px 10px;text-align:${right.has(i) ? 'right' : 'left'};font:13px var(--pm-font-num);white-space:nowrap">${c}</td>`).join('')}</tr>`).join('');
  return `<div class="pm-card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function renderTrend() {
  const rows = state.all.filter(inScope);
  const data = byMonth(rows, months);
  const max = Math.max(1, ...data.map((d) => d.net));
  document.getElementById('sales-trend').innerHTML = table(['月', '売上', '', '報酬', '粗利', '利益(概算)', '件数'],
    data.map((d) => [
      d.month === state.month ? `<b>${monthLabel(d.month)}</b>` : monthLabel(d.month),
      yen(d.net),
      `<div style="width:120px;height:8px;border-radius:4px;background:var(--pm-bg-mint)"><div style="width:${Math.round((d.net / max) * 100)}%;height:100%;border-radius:4px;background:var(--pm-brand-grad)"></div></div>`,
      yen(d.payout), yen(d.gross), yen(d.profit), `${d.bookings}`]), [1, 3, 4, 5, 6]);
}

function render() { renderSummary(); renderDetail(); renderTrend(); }

function setScope(id) {
  state.scope = id;
  document.getElementById('sales-scope').value = id;
  render();
}

function fillControls() {
  const monthEl = document.getElementById('sales-month');
  monthEl.innerHTML = [...months].reverse().map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  monthEl.value = state.month;
  monthEl.addEventListener('change', () => { state.month = monthEl.value; render(); });
  const people = byPhotographer(state.all);
  const scopeEl = document.getElementById('sales-scope');
  scopeEl.innerHTML = `<option value="all">フォトマッチ全体</option>${people.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}`;
  scopeEl.addEventListener('change', () => setScope(scopeEl.value));
}

document.getElementById('sales-csv').addEventListener('click', () => {
  const csv = `﻿${bookingsCsv(monthRows())}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `photomatch-sales-${state.month}${state.scope === 'all' ? '' : `-${state.scope}`}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  window.location.href = 'ops-login.html';
});

(async () => {
  const profile = await requireRole('ops', 'ops-login.html');
  if (!profile) return;
  try {
    state.all = await getBookingsForSales(`${months[0]}-01`, `${months[months.length - 1]}-31`);
  } catch (err) {
    console.error(err);
    document.getElementById('pm-loading').textContent = 'データの取得に失敗しました。';
    return;
  }
  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById('pm-sales').style.display = 'block';
  fillControls();
  render();
})();
