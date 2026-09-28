import { mountLayout } from '../layout.js';
import { getSession, getProfile, requestPasswordReset, updatePassword, safeNext } from '../auth.js';
import { t, tf } from '../i18n.js';

mountLayout();

const params = new URLSearchParams(location.search);
const rawNext = params.get('next');
const hashParams = new URLSearchParams((window.__pmAuthHash || '').replace(/^#/, ''));

function show(view) {
  document.getElementById('pm-loading').style.display = 'none';
  ['request-view', 'update-view', 'done-view'].forEach((id) => {
    document.getElementById(id).style.display = id === view ? '' : 'none';
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function destinationAfterReset() {
  const profile = await getProfile();
  const home = profile && profile.role === 'photographer' ? 'admin.html'
    : profile && profile.role === 'ops' ? 'ops.html' : 'mypage.html';
  return safeNext(rawNext, new URL(home, location.href).href);
}

// ---------- step 1: request ----------
document.getElementById('f-email').value = params.get('email') || '';
const requestBtn = document.getElementById('request-btn');
requestBtn.addEventListener('click', async () => {
  const email = document.getElementById('f-email').value.trim();
  const errorEl = document.getElementById('request-error');
  errorEl.style.display = 'none';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = t('reset.request.emailInvalid');
    errorEl.style.display = 'block';
    return;
  }
  requestBtn.disabled = true;
  try {
    await requestPasswordReset(email, safeNext(rawNext, ''));
    const done = document.getElementById('request-done');
    // Same message whether or not the address is registered, so this form
    // can't be used to find out who has an account.
    done.innerHTML = `<span class="pm-note-title">${t('reset.request.doneTitle')}</span>${tf('reset.request.doneBody', { email: escapeHtml(email) })}`;
    done.style.display = 'block';
    requestBtn.textContent = t('reset.request.resendButton');
  } catch (err) {
    errorEl.textContent = /rate limit|too many|seconds/i.test(err.message || '')
      ? t('reset.request.rateLimited')
      : t('reset.request.sendFailed');
    errorEl.style.display = 'block';
    console.error(err);
  } finally {
    requestBtn.disabled = false;
  }
});

// ---------- step 2: set new password ----------
const updateBtn = document.getElementById('update-btn');
updateBtn.addEventListener('click', async () => {
  const password = document.getElementById('f-password').value;
  const password2 = document.getElementById('f-password2').value;
  const errorEl = document.getElementById('update-error');
  errorEl.style.display = 'none';
  let message = '';
  if (password.length < 6) message = t('reset.update.passwordTooShort');
  else if (password !== password2) message = t('reset.update.passwordMismatch');
  if (message) { errorEl.textContent = message; errorEl.style.display = 'block'; return; }

  updateBtn.disabled = true;
  try {
    await updatePassword(password);
    const dest = await destinationAfterReset();
    document.getElementById('done-body').innerHTML = tf('reset.done.body', {
      link: `<a href="${dest}" id="done-link" style="color:oklch(0.45 0.14 210);font-weight:700">${t('reset.done.linkText')}</a>`,
    });
    show('done-view');
    setTimeout(() => { location.href = dest; }, 1500);
  } catch (err) {
    const msg = err.message || '';
    errorEl.textContent = /different from the old|same.*password/i.test(msg)
      ? t('reset.update.samePassword')
      : /session|expired|jwt/i.test(msg)
        ? t('reset.update.linkExpired')
        : t('reset.update.failed');
    errorEl.style.display = 'block';
    console.error(err);
    updateBtn.disabled = false;
  }
});

// ---------- init ----------
(async () => {
  if (rawNext && /booking\.html/.test(rawNext)) {
    const back = document.getElementById('back-link');
    back.href = safeNext(rawNext, 'login.html');
    back.textContent = t('reset.backToBooking');
  }

  if (hashParams.get('error_code') || hashParams.get('error')) {
    const el = document.getElementById('link-error');
    el.innerHTML = `<span class="pm-note-title">${t('reset.link.invalidTitle')}</span>${t('reset.link.invalidBody')}`;
    el.style.display = 'block';
    show('request-view');
    return;
  }

  if (hashParams.get('type') === 'recovery') {
    // getSession waits for the client to finish reading the recovery tokens.
    const session = await getSession();
    if (session) { show('update-view'); return; }
    const el = document.getElementById('link-error');
    el.innerHTML = `<span class="pm-note-title">${t('reset.link.expiredTitle')}</span>${t('reset.link.invalidBody')}`;
    el.style.display = 'block';
  }
  show('request-view');
})();
