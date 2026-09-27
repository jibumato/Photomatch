import { mountLayout } from '../layout.js';
import { signIn, signOut, getSession, getProfile } from '../auth.js';

mountLayout();

(async () => {
  const session = await getSession();
  if (!session) return;
  const profile = await getProfile();
  if (profile && profile.role === 'ops') location.href = 'ops.html';
})();

const submitBtn = document.getElementById('submit-btn');
const errorEl = document.getElementById('form-error');
const NEXT_FOR_RESET = new URL('ops.html', location.href).href;

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

submitBtn.addEventListener('click', async () => {
  const email = document.getElementById('f-email').value.trim();
  const password = document.getElementById('f-password').value;
  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  try {
    await signIn({ email, password });
    const profile = await getProfile();
    if (!profile || profile.role !== 'ops') {
      await signOut();
      throw new Error('このアカウントには運営権限がありません。');
    }
    location.href = 'ops.html';
  } catch (err) {
    errorEl.textContent = err.message || 'メールアドレスまたはパスワードが正しくありません。';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
  }
});
