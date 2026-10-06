import { mountLayout } from '../layout.js';
import { COLUMN_ARTICLES } from '../data.js';
import { getLang, t, applyI18n } from '../i18n.js';
import { tagText, readMinText } from '../i18n/columns.js';
import { COLUMN_EN } from '../i18n/columns-en.js';

mountLayout();

// English text when the visitor picked English and a translation exists;
// otherwise the Japanese source.
const textOf = (a, field) => (getLang() === 'en' && COLUMN_EN[a.id]?.[field]) || a[field];

function cardHtml(a) {
  const en = getLang() === 'en';
  const tag = en ? tagText(a.tag) : a.tag;
  const readMin = en ? readMinText(a.readMin) : `読了 約${a.readMin}分`;
  return `
  <a href="column-${a.id}.html" class="pm-card pm-column-card" style="display:block;padding:22px 24px;text-decoration:none;color:inherit">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:4px 10px;border-radius:100px">${tag}</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-muted)">${readMin}</span>
    </div>
    <div style="font:700 17px/1.6 var(--pm-font-body);color:oklch(0.24 0.02 240);margin-bottom:8px">${textOf(a, 'title')}</div>
    <p style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 10px">${textOf(a, 'lead')}</p>
  </a>`;
}

const sorted = [...COLUMN_ARTICLES].sort((a, b) => a.priority - b.priority);
document.getElementById('pm-column-list').innerHTML = sorted.map(cardHtml).join('');

if (getLang() === 'en') {
  applyI18n();
  document.title = t('column.list.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('column.list.metaDesc'));
}
