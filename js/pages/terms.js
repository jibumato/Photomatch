import { mountLayout } from '../layout.js';
import { LEGAL_PAGES } from '../data.js';

mountLayout();

const VALID_KEYS = ['company', 'tokushoho', 'privacy', 'terms'];
const params = new URLSearchParams(location.search);
const key = params.get('key');
const page = LEGAL_PAGES[VALID_KEYS.includes(key) ? key : 'company'];

document.title = `${page.title} | PhotoMatch`;
document.getElementById('pm-legal-title').textContent = page.title;
document.getElementById('pm-legal-intro').textContent = page.intro;

const bodyEl = document.getElementById('pm-legal-body');

if (page.rows) {
  bodyEl.innerHTML = `
  <div style="border:1px solid var(--pm-border);border-radius:var(--pm-radius-card);overflow:hidden">
    ${page.rows.map((row, idx) => `
    <div style="display:grid;grid-template-columns:160px 1fr;${idx > 0 ? 'border-top:1px solid var(--pm-border-soft)' : ''}">
      <div style="background:oklch(0.98 0.008 215);padding:14px 16px;font:700 13px var(--pm-font-body);color:oklch(0.32 0.02 240)">${row.k}</div>
      <div style="padding:14px 16px;font:14px/1.8 var(--pm-font-body);color:var(--pm-text-2)">${row.v}</div>
    </div>`).join('')}
  </div>`;
} else if (page.sections) {
  bodyEl.innerHTML = page.sections.map((s) => `
  <div style="margin-bottom:32px">
    <h2 style="font:700 17px var(--pm-font-body);margin:0 0 10px;padding-bottom:10px;border-bottom:1px solid var(--pm-border-soft)">${s.h}</h2>
    <p style="font:14px/1.9 var(--pm-font-body);color:var(--pm-text-2);margin:0">${s.b}</p>
  </div>`).join('');
}
