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
