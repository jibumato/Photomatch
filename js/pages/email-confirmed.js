import { mountLayout } from '../layout.js';
import { getSession, getProfile, safeNext } from '../auth.js';
import { t } from '../i18n.js';

mountLayout();

const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams((window.__pmAuthHash || '').replace(/^#/, ''));
const isPro = params.get('pro') === '1';

function show(id) {
  document.getElementById('pm-loading').style.display = 'none';
  document.getElementById(id).style.display = 'block';
}

function showError() {
  const btn = document.getElementById('login-btn');
  if (isPro) {
    btn.href = 'pro-login.html';
    btn.classList.replace('pm-btn-primary', 'pm-btn-navy');
  }
  show('error-view');
}

(async () => {
  // Supabase sends an already-used or expired link here with error params
  // instead of tokens.
  if (hashParams.get('error') || hashParams.get('error_code')) { showError(); return; }

  // getSession waits for the client to finish reading the tokens from the hash.
  const session = await getSession();
  if (!session) { showError(); return; }

  const profile = await getProfile();
  const role = profile && profile.role;
  const home = role === 'photographer' ? 'admin.html' : role === 'ops' ? 'ops.html' : 'mypage.html';
  const homeUrl = new URL(home, location.href).href;
  const dest = safeNext(params.get('next'), homeUrl);

  const btn = document.getElementById('continue-btn');
  btn.href = dest;
  if (role === 'photographer') {
    document.getElementById('success-lead').textContent = t('confirm.lead.pro');
    document.getElementById('pro-steps').style.display = 'block';
    btn.textContent = t('confirm.cta.pro');
    btn.classList.replace('pm-btn-primary', 'pm-btn-navy');
  } else {
    document.getElementById('success-lead').textContent = t('confirm.lead.client');
    btn.textContent = dest === homeUrl ? t('confirm.cta.mypage') : t('confirm.cta.continue');
  }
  show('success-view');
})();
