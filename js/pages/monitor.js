import { mountLayout } from '../layout.js';
import { getSession } from '../auth.js';
import { submitMonitorApplication, getMyMonitorApplications } from '../repo.js';
import { MONITOR_CONDITIONS, MONITOR_STEPS } from '../data.js';

mountLayout();

document.getElementById('pm-monitor-conditions').innerHTML = MONITOR_CONDITIONS.map((c) => `
  <div style="display:flex;align-items:flex-start;gap:10px">
    <span style="font:700 14px var(--pm-font-num);color:oklch(0.5 0.14 210);flex-shrink:0">✓</span>
    <span style="font:13px/1.8 var(--pm-font-body);color:oklch(0.35 0.02 235)">${c}</span>
  </div>`).join('');

document.getElementById('pm-monitor-steps').innerHTML = MONITOR_STEPS.map((s) => `
  <div class="pm-card" style="padding:22px 24px;display:flex;gap:16px;align-items:flex-start">
    <div style="display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 14px var(--pm-font-num);flex-shrink:0">${s.step}</div>
    <div>
      <div style="font:700 15px var(--pm-font-body);margin-bottom:4px">${s.title}</div>
      <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3)">${s.desc}</div>
    </div>
  </div>`).join('');

const STATUS_LABEL = {
  applied: { label: '審査中', color: 'oklch(0.55 0.14 90)' },
  accepted: { label: '当選', color: 'oklch(0.5 0.14 160)' },
  rejected: { label: '落選', color: 'oklch(0.5 0.02 235)' },
  completed: { label: '撮影完了', color: 'oklch(0.5 0.14 210)' },
};

const appEl = document.getElementById('pm-monitor-app');

function formHtml() {
  return `
  <div class="pm-card" style="padding:28px">
    <div style="font:700 16px var(--pm-font-body);margin-bottom:18px">応募フォーム</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="pm-field">
        <label>現在使用中のマッチングアプリ（任意）</label>
        <input class="pm-input" type="text" id="f-apps" placeholder="例）Pairs、with など">
      </div>
      <div class="pm-field">
        <label>応募理由・ひとこと（任意）</label>
        <textarea class="pm-textarea" id="f-motivation" rows="3" placeholder="モニター企画に応募した理由などをご自由にご記入ください"></textarea>
      </div>
      <label style="display:flex;align-items:flex-start;gap:8px;font:13px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);cursor:pointer">
        <input type="checkbox" id="f-has-photos" style="margin-top:3px">
        <span>現在マッチングアプリで使用中の写真がある<span style="color:var(--pm-warn-text)">*</span>（施策前後の比較にご協力いただきます）</span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font:13px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);cursor:pointer">
        <input type="checkbox" id="f-follow-up" style="margin-top:3px">
        <span>撮影から約1ヶ月後の任意アンケートに協力できる</span>
      </label>
      <div class="pm-error-text" id="f-error" style="display:none"></div>
      <button class="pm-btn pm-btn-primary pm-btn-block" id="f-submit">応募する</button>
    </div>
  </div>`;
}

function loginPromptHtml() {
  return `
  <div class="pm-card" style="padding:28px;text-align:center">
    <div style="font:700 16px var(--pm-font-body);margin-bottom:8px">応募にはログインが必要です</div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 18px">施策前後のマッチング数を比較するため、アカウントに紐づけてご応募いただいています。</p>
    <a class="pm-btn pm-btn-primary" href="login.html?next=monitor.html">ログイン / 新規登録して応募する</a>
  </div>`;
}

function statusHtml(app) {
  const s = STATUS_LABEL[app.status] || STATUS_LABEL.applied;
  return `
  <div class="pm-card" style="padding:28px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font:700 12px var(--pm-font-body);color:#fff;background:${s.color};border-radius:100px;padding:4px 12px">${s.label}</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">応募日: ${new Date(app.applied_at).toLocaleDateString('ja-JP')}</span>
    </div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">すでにモニター企画にご応募いただいています。審査結果はメールでご連絡します。</p>
  </div>`;
}

async function render() {
  const session = await getSession();
  if (!session) {
    appEl.innerHTML = loginPromptHtml();
    return;
  }
  const apps = await getMyMonitorApplications();
  if (apps.length) {
    appEl.innerHTML = statusHtml(apps[0]);
    return;
  }
  appEl.innerHTML = formHtml();
  document.getElementById('f-submit').addEventListener('click', async () => {
    const errorEl = document.getElementById('f-error');
    const btn = document.getElementById('f-submit');
    const hasExistingPhotos = document.getElementById('f-has-photos').checked;
    errorEl.style.display = 'none';
    if (!hasExistingPhotos) {
      errorEl.textContent = '現在使用中の写真がある方のみご応募いただけます。';
      errorEl.style.display = 'block';
      return;
    }
    btn.disabled = true;
    try {
      await submitMonitorApplication({
        hasExistingPhotos,
        currentApps: document.getElementById('f-apps').value.trim(),
        motivation: document.getElementById('f-motivation').value.trim(),
        followUpOptIn: document.getElementById('f-follow-up').checked,
      });
      await render();
    } catch (err) {
      errorEl.textContent = err.message || '応募に失敗しました。時間をおいて再度お試しください。';
      errorEl.style.display = 'block';
      btn.disabled = false;
    }
  });
}

render();
