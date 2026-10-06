// Calendar file (.ics, RFC 5545) attached to booking emails, so the shoot can
// be added to iPhone / Google / Outlook calendars in one tap. The UID is fixed
// per booking and SEQUENCE grows with each reschedule, so calendars that
// support updates replace the old entry instead of adding a second one.
import { meetingPointForArea } from '../../js/data.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets are folded (CRLF + space), without splitting a
// multi-byte character.
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// "2026-10-09" + "10:00:00" (Japan time) -> "20261009T010000Z"
function utcStamp(dateIso, time) {
  const d = new Date(`${dateIso}T${String(time).slice(0, 5)}:00+09:00`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// method: 'PUBLISH' (new / changed booking) or 'CANCEL' (canceled booking).
// audience: 'customer' | 'photographer' (changes the title and the link).
export function bookingIcs(b, { photographerName, audience, method = 'PUBLISH', origin }) {
  const meeting = meetingPointForArea(b.area);
  const summary = audience === 'photographer'
    ? `【PhotoMatch】撮影：${b.customer_name || '依頼者'} 様`
    : `【PhotoMatch】撮影（${photographerName}）`;
  const description = [
    `プラン：${b.plan_name || '-'}`,
    `撮影エリア：${b.area || '-'}`,
    meeting ? `集合場所：${meeting.detail}` : null,
    audience === 'photographer' ? `依頼者の連絡先：${b.customer_contact || '-'}` : `カメラマン：${photographerName}`,
    `予約の確認：${origin}/${audience === 'photographer' ? 'admin.html' : 'mypage.html'}`,
  ].filter(Boolean).join('\n');
  const canceled = method === 'CANCEL';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PhotoMatch//Booking//JA',
    'CALSCALE:GREGORIAN',
    `METHOD:${canceled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:booking-${b.id}@photo-match.jp`,
    `SEQUENCE:${(b.rescheduled_count || 0) + (canceled ? 1 : 0)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${utcStamp(b.booking_date, b.start_time)}`,
    `DTEND:${utcStamp(b.booking_date, b.end_time || b.start_time)}`,
    `SUMMARY:${esc(canceled ? `【キャンセル】${summary}` : summary)}`,
    `LOCATION:${esc(meeting ? meeting.detail : (b.area || ''))}`,
    `DESCRIPTION:${esc(description)}`,
    `STATUS:${canceled ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (!canceled) {
    // Reminders the day before and 1 hour before (calendars that ignore
    // alarms in imported files just skip these).
    for (const trigger of ['-P1D', '-PT1H']) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Resend attachment object for an .ics string.
export function icsAttachment(ics, filename = 'photomatch-booking.ics') {
  const bytes = new TextEncoder().encode(ics);
  let bin = '';
  bytes.forEach((x) => { bin += String.fromCharCode(x); });
  return { filename, content: btoa(bin), content_type: 'text/calendar; charset=utf-8' };
}
