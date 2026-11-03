import { setMetaDescription } from '../i18n/static-pages.js';
import { mountLayout } from '../layout.js';
import { t, tf, L } from '../i18n.js';
import { MEETING_POINTS, seasonalMeetingList, seasonForMonth, jstDateIso, mapUrlFor } from '../data.js';
import { escapeHtml } from '../util.js';

mountLayout();
setMetaDescription('meeting.metaDesc');

// 季節で集合場所が変わるエリア（岐阜）は、季節ごとの一覧を出し、地図は今の季節の集合場所にする。
function seasonalHtml(mp, nowSeason) {
  return `
      <p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 6px">${t('meeting.seasonalLead')}</p>
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
        ${seasonalMeetingList(mp).map((s) => `
        <li style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-2)">
          <b>${escapeHtml(L(s, 'label'))}（${escapeHtml(L(s, 'range'))}）</b>${s.season === nowSeason ? ` <span class="pm-badge">${t('meeting.now')}</span>` : ''}<br>
          ${escapeHtml(L(s, 'detail'))}
          <a href="${mapUrlFor(s)}" target="_blank" rel="noopener noreferrer" style="font:700 12px var(--pm-font-body);color:oklch(0.45 0.14 210);white-space:nowrap">${t('meeting.map')} ↗</a>
        </li>`).join('')}
      </ul>`;
}

function cardHtml(mp) {
  const nowSeason = seasonForMonth(Number(jstDateIso().slice(5, 7))).key;
  const mapMp = mp.seasonal ? { ...mp, ...mp.seasonal[nowSeason] } : mp;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(mapMp.mapQuery)}&output=embed`;
  return `
  <div class="pm-card" style="overflow:hidden">
    <div style="padding:20px 24px 16px">
      <h2 style="font:700 17px var(--pm-font-body);margin:0 0 6px">${tf('meeting.areaTitle', { label: L(mp, 'label') })}</h2>
      ${mp.seasonal ? seasonalHtml(mp, nowSeason) : `<p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${L(mp, 'detail')}</p>`}
      ${mp.evening ? `<p style="font:700 13px/1.8 var(--pm-font-body);color:oklch(0.4 0.1 215);margin:8px 0 0">${L(mp, 'evening')}</p>` : ''}
    </div>
    <div style="border-radius:0 0 var(--pm-radius-card) var(--pm-radius-card);overflow:hidden">
      <iframe src="${src}" width="100%" height="220" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>`;
}

document.getElementById('pm-meeting-points').innerHTML = MEETING_POINTS.map(cardHtml).join('');
