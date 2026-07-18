import { mountLayout } from '../layout.js';
import { MEETING_POINTS } from '../data.js';

mountLayout();

function cardHtml(mp) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(mp.mapQuery)}&output=embed`;
  return `
  <div class="pm-card" style="overflow:hidden">
    <div style="padding:20px 24px 16px">
      <h2 style="font:700 17px var(--pm-font-body);margin:0 0 6px">${mp.label}エリア</h2>
      <p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${mp.detail}</p>
    </div>
    <div style="border-radius:0 0 var(--pm-radius-card) var(--pm-radius-card);overflow:hidden">
      <iframe src="${src}" width="100%" height="220" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>`;
}

document.getElementById('pm-meeting-points').innerHTML = MEETING_POINTS.map(cardHtml).join('');
