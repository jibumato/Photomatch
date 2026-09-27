import { mountLayout } from '../layout.js';
import { signIn, signUp, getSession } from '../auth.js';

mountLayout();

const params = new URLSearchParams(location.search);
const next = params.get('next');

(async () => {
  const session = await getSession();
  if (session) location.href = next || 'mypage.html';
})();

let mode = 'login';
const title = document.getElementById('form-title');
const nameField = document.getElementById('name-field');
const submitBtn = document.getElementById('submit-btn');
const toggle = document.getElementById('toggle-mode');
const errorEl = document.getElementById('form-error');

toggle.addEventListener('click', () => {
  mode = mode === 'login' ? 'signup' : 'login';
  if (mode === 'signup') {
    title.textContent = '新規登録';
    nameField.style.display = 'block';
    submitBtn.textContent = '登録する';
    toggle.textContent = 'ログイン';
    toggle.previousSibling.textContent = 'すでにアカウントをお持ちの方は ';
  } else {
    title.textContent = 'ログイン';
    nameField.style.display = 'none';
    submitBtn.textContent = 'ログイン';
    toggle.textContent = '新規登録';
    toggle.previousSibling.textContent = 'アカウントをお持ちでない方は ';
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
      const data = await signUp({
        email, password, name, role: 'client',
        redirectTo: new URL(next || 'mypage.html', location.href).href,
      });
      // With Supabase "Confirm email" on, there's no session until the emailed
      // link is opened — redirecting now would just bounce back to login.
      if (!data.session) {
        errorEl.textContent = `${email} に確認メールをお送りしました。メール内のリンクを開くと登録が完了します。`;
        errorEl.style.display = 'block';
        return;
      }
    } else {
      await signIn({ email, password });
    }
    location.href = next || 'mypage.html';
  } catch (err) {
    errorEl.textContent = err.message || 'メールアドレスまたはパスワードが正しくありません。';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
  }
});
