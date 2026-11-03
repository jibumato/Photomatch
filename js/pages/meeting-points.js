import { setMetaDescription } from '../i18n/static-pages.js';
import { mountLayout } from '../layout.js';
import { t, tf, L } from '../i18n.js';
import { MEETING_POINTS, seasonalMeetingList, seasonForMonth, jstDateIso, mapUrlFor } from '../data.js';
import { escapeHtml } from '../util.js';

mountLayout();
setMetaDescription('meeting.metaDesc');

const mapEmbed = (query, title, height) => `<iframe title="${escapeHtml(title)}" src="https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed" width="100%" height="${height}" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

// 季節で集合場所が変わるエリア（名古屋・岐阜）は、季節ごとに集合場所と地図を並べ、今の季節に印を付ける。
function seasonalHtml(mp, nowSeason) {
  return `
      <p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 12px">${t('meeting.seasonalLead')}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
        ${seasonalMeetingList(mp).map((s) => `
        <div style="border:1px solid var(--pm-border);border-radius:14px;overflow:hidden;background:#fff${s.season === nowSeason ? ';box-shadow:0 0 0 2px oklch(0.75 0.11 205)' : ''}">
          <div style="padding:12px 14px">
            <div style="font:700 14px/1.6 var(--pm-font-body);color:var(--pm-text-2)">${escapeHtml(L(s, 'label'))}（${escapeHtml(L(s, 'range'))}）${s.season === nowSeason ? ` <span class="pm-badge">${t('meeting.now')}</span>` : ''}</div>
            <div style="font:14px/1.7 var(--pm-font-body);color:var(--pm-text-2)">${escapeHtml(L(s, 'detail'))}</div>
            <a href="${mapUrlFor(s)}" target="_blank" rel="noopener noreferrer" style="font:700 12px var(--pm-font-body);color:oklch(0.45 0.14 210);white-space:nowrap">${t('meeting.openMap')} ↗</a>
          </div>
          ${mapEmbed(s.mapQuery, `${L(s, 'label')}：${L(s, 'detail')}`, 180)}
        </div>`).join('')}
      </div>`;
}

function cardHtml(mp) {
  const nowSeason = seasonForMonth(Number(jstDateIso().slice(5, 7))).key;
  return `
  <div class="pm-card" style="overflow:hidden">
    <div style="padding:20px 24px ${mp.seasonal ? '22px' : '16px'}">
      <h2 style="font:700 17px var(--pm-font-body);margin:0 0 6px">${tf('meeting.areaTitle', { label: L(mp, 'label') })}</h2>
      ${mp.seasonal ? seasonalHtml(mp, nowSeason) : `<p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${L(mp, 'detail')}</p>`}
      ${mp.evening ? `<p style="font:700 13px/1.8 var(--pm-font-body);color:oklch(0.4 0.1 215);margin:12px 0 0">${L(mp, 'evening')}</p>` : ''}
    </div>
    ${mp.seasonal ? '' : mapEmbed(mp.mapQuery, L(mp, 'detail'), 220)}
  </div>`;
}

document.getElementById('pm-meeting-points').innerHTML = MEETING_POINTS.map(cardHtml).join('');
