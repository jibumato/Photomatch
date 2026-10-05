import { mountLayout } from '../layout.js';
import { signIn, signUp, getSession, safeNext } from '../auth.js';
import { t, tf, getLang } from '../i18n.js';
import { CUSTOMER_GENDERS } from '../data.js';

mountLayout();

const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'), '');

(async () => {
  const session = await getSession();
  if (session) location.href = next || 'mypage.html';
})();

let mode = 'login';
const title = document.getElementById('form-title');
const nameField = document.getElementById('name-field');
const genderField = document.getElementById('gender-field');
const genderEl = document.getElementById('f-gender');
genderEl.innerHTML = `<option value="">${t('login.gender.placeholder')}</option>`
  + CUSTOMER_GENDERS.map((g) => `<option value="${g.key}">${getLang() === 'en' ? g.labelEn : g.label}</option>`).join('');
const submitBtn = document.getElementById('submit-btn');
const toggle = document.getElementById('toggle-mode');
const togglePrefix = document.getElementById('toggle-prefix');
const errorEl = document.getElementById('form-error');
const NEXT_FOR_RESET = next;

// Carries the typed email (and where to return) over to the reset page.
const forgotLink = document.getElementById('forgot-link');
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  const url = new URL('reset-password.html', location.href);
  const email = document.getElementById('f-email').value.trim();
  if (email) url.searchParams.set('email', email);
  if (NEXT_FOR_RESET) url.searchParams.set('next', NEXT_FOR_RESET);
  location.href = url.href;
});

toggle.addEventListener('click', () => {
  mode = mode === 'login' ? 'signup' : 'login';
  if (mode === 'signup') {
    title.textContent = t('login.title.signup');
    nameField.style.display = 'block';
    genderField.style.display = 'block';
    forgotLink.style.display = 'none';
    submitBtn.textContent = t('login.submit.signup');
    toggle.textContent = t('login.toggle.toLogin.link');
    togglePrefix.textContent = t('login.toggle.toLogin.prefix');
  } else {
    title.textContent = t('login.title.login');
    nameField.style.display = 'none';
    genderField.style.display = 'none';
    forgotLink.style.display = '';
    submitBtn.textContent = t('login.submit.login');
    toggle.textContent = t('login.toggle.toSignup.link');
    togglePrefix.textContent = t('login.toggle.toSignup.prefix');
  }
  errorEl.style.display = 'none';
});

submitBtn.addEventListener('click', async () => {
  const email = document.getElementById('f-email').value.trim();
  const password = document.getElementById('f-password').value;
  const name = document.getElementById('f-name').value.trim();
  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  try {
    if (mode === 'signup') {
      if (!genderEl.value) {
        errorEl.textContent = t('login.gender.required');
        errorEl.style.display = 'block';
        return;
      }
      const confirmUrl = new URL('email-confirmed.html', location.href);
      if (next) confirmUrl.searchParams.set('next', next);
      const data = await signUp({
        email, password, name, gender: genderEl.value, role: 'client',
        redirectTo: confirmUrl.href,
      });
      // With Supabase "Confirm email" on, there's no session until the emailed
      // link is opened — redirecting now would just bounce back to login.
      if (!data.session) {
        errorEl.textContent = tf('login.signupConfirmSent', { email });
        errorEl.style.display = 'block';
        return;
      }
    } else {
      await signIn({ email, password });
    }
    location.href = next || 'mypage.html';
  } catch (err) {
    errorEl.textContent = err.message || t('login.genericError');
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
  }
});
