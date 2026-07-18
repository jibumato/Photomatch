import { mountLayout } from '../layout.js';
import { COLUMN_ARTICLES } from '../data.js';

mountLayout();

const params = new URLSearchParams(location.search);
const id = params.get('id') || 'nagoya';
const article = COLUMN_ARTICLES.find((a) => a.id === id) || COLUMN_ARTICLES.find((a) => a.id === 'nagoya') || COLUMN_ARTICLES[0];

document.title = `${article.title} | PhotoMatch`;

document.getElementById('pm-article-meta').innerHTML = `
  <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:4px 10px;border-radius:100px">${article.tag}</span>
  <span style="font:12px var(--pm-font-body);color:var(--pm-text-muted)">読了 約${article.readMin}分</span>`;

document.getElementById('pm-article-title').textContent = article.title;
document.getElementById('pm-article-lead').textContent = article.lead;

document.getElementById('pm-article-sections').innerHTML = article.sections.map((s) => `
  <div style="margin-bottom:36px">
    <h2 style="font:700 19px var(--pm-font-body);margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid var(--pm-border-soft)">${s.h}</h2>
    <p style="font:14px/1.9 var(--pm-font-body);color:var(--pm-text-2);margin:0">${s.b}</p>
  </div>`).join('');
