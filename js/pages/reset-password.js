import { mountLayout } from '../layout.js';
import { getSession, getProfile, requestPasswordReset, updatePassword, safeNext } from '../auth.js';

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
    errorEl.textContent = 'メールアドレスを正しくご記入ください。';
    errorEl.style.display = 'block';
    return;
  }
  requestBtn.disabled = true;
  try {
    await requestPasswordReset(email, safeNext(rawNext, ''));
    const done = document.getElementById('request-done');
    // Same message whether or not the address is registered, so this form
    // can't be used to find out who has an account.
    done.innerHTML = `<span class="pm-note-title">メールを送信しました</span>${escapeHtml(email)} がご登録済みの場合、パスワード再設定用のリンクをお送りしました。メール内のリンクを開いて、新しいパスワードを設定してください。届かない場合は迷惑メールフォルダもご確認ください。`;
    done.style.display = 'block';
    requestBtn.textContent = 'もう一度送る';
  } catch (err) {
    errorEl.textContent = /rate limit|too many|seconds/i.test(err.message || '')
      ? '短時間に何度も送信されています。数分おいてから再度お試しください。'
      : '送信に失敗しました。時間をおいて再度お試しください。';
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
  if (password.length < 6) message = 'パスワードは6文字以上でご記入ください。';
  else if (password !== password2) message = '確認用のパスワードが一致しません。';
  if (message) { errorEl.textContent = message; errorEl.style.display = 'block'; return; }

  updateBtn.disabled = true;
  try {
    await updatePassword(password);
    const dest = await destinationAfterReset();
    document.getElementById('done-link').href = dest;
    show('done-view');
    setTimeout(() => { location.href = dest; }, 1500);
  } catch (err) {
    const msg = err.message || '';
    errorEl.textContent = /different from the old|same.*password/i.test(msg)
      ? '以前と同じパスワードは使えません。別のパスワードをご入力ください。'
      : /session|expired|jwt/i.test(msg)
        ? 'リンクの有効期限が切れています。お手数ですが、再設定メールをもう一度お送りください。'
        : 'パスワードを変更できませんでした。時間をおいて再度お試しください。';
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
    back.textContent = '← ご予約に戻る';
  }

  if (hashParams.get('error_code') || hashParams.get('error')) {
    const el = document.getElementById('link-error');
    el.innerHTML = '<span class="pm-note-title">リンクが無効か、有効期限が切れています</span>お手数ですが、下のフォームから再設定メールをもう一度お送りください。';
    el.style.display = 'block';
    show('request-view');
    return;
  }

  if (hashParams.get('type') === 'recovery') {
    // getSession waits for the client to finish reading the recovery tokens.
    const session = await getSession();
    if (session) { show('update-view'); return; }
    const el = document.getElementById('link-error');
    el.innerHTML = '<span class="pm-note-title">リンクの有効期限が切れています</span>お手数ですが、下のフォームから再設定メールをもう一度お送りください。';
    el.style.display = 'block';
  }
  show('request-view');
})();
