import { mountLayout } from '../layout.js';
import { COLUMN_ARTICLES } from '../data.js';

mountLayout();

function cardHtml(a) {
  return `
  <a href="article.html?id=${a.id}" class="pm-card pm-column-card" style="display:block;padding:22px 24px;text-decoration:none;color:inherit">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span style="font:700 11px var(--pm-font-body);color:#fff;background:var(--pm-brand-grad);padding:4px 10px;border-radius:100px">優先度 ${a.priority}</span>
      <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:4px 10px;border-radius:100px">${a.tag}</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-muted)">読了 約${a.readMin}分</span>
    </div>
    <div style="font:700 17px/1.6 var(--pm-font-body);color:oklch(0.24 0.02 240);margin-bottom:8px">${a.title}</div>
    <p style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 10px">${a.lead}</p>
    <div style="font:12px var(--pm-font-body);color:oklch(0.45 0.14 210)">狙うキーワード： ${a.keyword}</div>
  </a>`;
}

const sorted = [...COLUMN_ARTICLES].sort((a, b) => a.priority - b.priority);
document.getElementById('pm-column-list').innerHTML = sorted.map(cardHtml).join('');
