// 生成済みのエリア別ページ（nagoya.html / gifu.html。scripts/area-pages.mjs）用。
// 本文は静的HTMLなので、共通ヘッダー／フッターを差し込み、今の季節のスポットに印を付けるだけ。
import { mountLayout } from '../layout.js';
import { seasonForMonth, jstDateIso } from '../data.js';

mountLayout();

const now = seasonForMonth(Number(jstDateIso().slice(5, 7))).key;
document.querySelectorAll(`.pm-loc-card[data-season="${now}"]`).forEach((card) => {
  card.classList.add('is-now');
  const row = card.querySelector('.pm-loc-season')?.parentElement;
  if (row) row.insertAdjacentHTML('beforeend', '<span class="pm-loc-now">今の季節</span>');
});
