// Transactional email via Resend's HTTP API (plain fetch, works on the
// Workers runtime). Kept to one function so the provider is easy to swap.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'PhotoMatch <no-reply@photo-match.jp>';
const REPLY_TO = 'info.photomatch@gmail.com';

export async function sendEmail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    // Lets the site deploy before email is configured without breaking the
    // payment/cancel flows that call this.
    console.warn('RESEND_API_KEY is not set; skipping email:', subject);
    return { skipped: true };
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || DEFAULT_FROM, to: [to], reply_to: REPLY_TO, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}
