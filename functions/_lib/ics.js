// Calendar files (.ics, RFC 5545):
// - bookingIcs: one booking, attached to booking emails, so the shoot can be
//   added to iPhone / Google / Outlook calendars in one tap. The UID is fixed
//   per booking and SEQUENCE grows with each reschedule, so calendars that
//   support updates replace the old entry instead of adding a second one.
// - feedIcs: all of a photographer's upcoming shoots, served at their
//   calendar URL (functions/api/calendar/[token].js) for Google Calendar's
//   「URLで追加」 and iPhone's subscribed calendars.
// What an event says (title, description, place) comes from
// bookingCalendarEvent in js/data.js, shared with the 「Googleカレンダーに追加」 links.
import { bookingCalendarEvent } from '../../js/data.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

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

const nowStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function veventLines(b, { photographerName, audience, origin, canceled = false, alarms = true, includeContact = true }) {
  const ev = bookingCalendarEvent(b, { audience, photographerName, origin, includeContact });
  const lines = [
    'BEGIN:VEVENT',
    `UID:booking-${b.id}@photo-match.jp`,
    `SEQUENCE:${(b.rescheduled_count || 0) + (canceled ? 1 : 0)}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART:${ev.start}`,
    `DTEND:${ev.end}`,
    `SUMMARY:${esc(canceled ? `【キャンセル】${ev.summary}` : ev.summary)}`,
    `LOCATION:${esc(ev.location)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `STATUS:${canceled ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (!canceled && alarms) {
    // Reminders the day before and 1 hour before (calendars that ignore
    // alarms in imported files just skip these).
    for (const trigger of ['-P1D', '-PT1H']) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.summary)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
  }
  lines.push('END:VEVENT');
  return lines;
}

const serialize = (lines) => lines.map(fold).join('\r\n') + '\r\n';

// method: 'PUBLISH' (new / changed booking) or 'CANCEL' (canceled booking).
// audience: 'customer' | 'photographer' (changes the title and the link).
export function bookingIcs(b, { photographerName, audience, method = 'PUBLISH', origin }) {
  const canceled = method === 'CANCEL';
  return serialize([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PhotoMatch//Booking//JA',
    'CALSCALE:GREGORIAN',
    `METHOD:${canceled ? 'CANCEL' : 'PUBLISH'}`,
    ...veventLines(b, { photographerName, audience, origin, canceled }),
    'END:VCALENDAR',
  ]);
}

// A photographer's subscribed calendar: their active bookings. Canceled ones
// are simply left out (subscribed calendars drop events that disappear).
// No customer contact details: the feed URL is stored by Google / Apple.
export function feedIcs(bookings, { photographerName, origin }) {
  return serialize([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PhotoMatch//Photographer Feed//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`PhotoMatch 撮影予定（${photographerName || 'カメラマン'}）`)}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...bookings.flatMap((b) => veventLines(b, { photographerName, audience: 'photographer', origin, alarms: true, includeContact: false })),
    'END:VCALENDAR',
  ]);
}

// Resend attachment object for an .ics string.
export function icsAttachment(ics, filename = 'photomatch-booking.ics') {
  const bytes = new TextEncoder().encode(ics);
  let bin = '';
  bytes.forEach((x) => { bin += String.fromCharCode(x); });
  return { filename, content: btoa(bin), content_type: 'text/calendar; charset=utf-8' };
}
