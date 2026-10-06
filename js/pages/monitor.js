import { setMetaDescription } from '../i18n/static-pages.js';
import { mountLayout } from '../layout.js';
import { t, tf, L, getLang } from '../i18n.js';
import { getSession } from '../auth.js';
import { submitMonitorApplication, getMyMonitorApplications, getMonitorSlotsLeft } from '../repo.js';
import { MONITOR_CAPACITY } from '../data.js';
import { MONITOR_CONDITIONS, MONITOR_CONDITIONS_EN, MONITOR_STEPS } from '../data.js';

mountLayout();
setMetaDescription('monitor.metaDesc');

const conditions = getLang() === 'en' && MONITOR_CONDITIONS_EN.length === MONITOR_CONDITIONS.length ? MONITOR_CONDITIONS_EN : MONITOR_CONDITIONS;
document.getElementById('pm-monitor-conditions').innerHTML = conditions.map((c) => `
  <div style="display:flex;align-items:flex-start;gap:10px">
    <span style="font:700 14px var(--pm-font-num);color:oklch(0.5 0.14 210);flex-shrink:0">✓</span>
    <span style="font:13px/1.8 var(--pm-font-body);color:oklch(0.35 0.02 235)">${c}</span>
  </div>`).join('');

document.getElementById('pm-monitor-steps').innerHTML = MONITOR_STEPS.map((s) => `
  <div class="pm-card" style="padding:22px 24px;display:flex;gap:16px;align-items:flex-start">
    <div style="display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:50%;background:var(--pm-brand-grad);color:#fff;font:800 14px var(--pm-font-num);flex-shrink:0">${s.step}</div>
    <div>
      <div style="font:700 15px var(--pm-font-body);margin-bottom:4px">${L(s, 'title')}</div>
      <div style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3)">${L(s, 'desc')}</div>
    </div>
  </div>`).join('');

const STATUS_LABEL = {
  applied: { key: 'monitor.status.applied', color: 'oklch(0.55 0.14 90)' },
  accepted: { key: 'monitor.status.accepted', color: 'oklch(0.5 0.14 160)' },
  rejected: { key: 'monitor.status.rejected', color: 'oklch(0.5 0.02 235)' },
  completed: { key: 'monitor.status.completed', color: 'oklch(0.5 0.14 210)' },
};

const appEl = document.getElementById('pm-monitor-app');

function formHtml() {
  return `
  <div class="pm-card" style="padding:28px">
    <div style="font:700 16px var(--pm-font-body);margin-bottom:18px">${t('monitor.form.title')}</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="pm-field">
        <label>${t('monitor.form.apps.label')}</label>
        <input class="pm-input" type="text" id="f-apps" placeholder="${t('monitor.form.apps.placeholder')}">
      </div>
      <div class="pm-field">
        <label>${t('monitor.form.motivation.label')}</label>
        <textarea class="pm-textarea" id="f-motivation" rows="3" placeholder="${t('monitor.form.motivation.placeholder')}"></textarea>
      </div>
      <label style="display:flex;align-items:flex-start;gap:8px;font:13px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);cursor:pointer">
        <input type="checkbox" id="f-has-photos" style="margin-top:3px">
        <span>${t('monitor.form.hasPhotos.a')}<span style="color:var(--pm-warn-text)">*</span>${t('monitor.form.hasPhotos.b')}</span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font:13px/1.7 var(--pm-font-body);color:oklch(0.35 0.02 235);cursor:pointer">
        <input type="checkbox" id="f-follow-up" style="margin-top:3px">
        <span>${t('monitor.form.followUp')}</span>
      </label>
      <div class="pm-error-text" id="f-error" style="display:none"></div>
      <button class="pm-btn pm-btn-primary pm-btn-block" id="f-submit">${t('monitor.form.submit')}</button>
    </div>
  </div>`;
}

function loginPromptHtml() {
  return `
  <div class="pm-card" style="padding:28px;text-align:center">
    <div style="font:700 16px var(--pm-font-body);margin-bottom:8px">${t('monitor.login.title')}</div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 18px">${t('monitor.login.body')}</p>
    <a class="pm-btn pm-btn-primary" href="login.html?next=monitor.html">${t('monitor.login.cta')}</a>
  </div>`;
}

function appliedDate(iso) {
  const d = new Date(iso);
  return getLang() === 'en'
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : d.toLocaleDateString('ja-JP');
}

function statusHtml(app) {
  const s = STATUS_LABEL[app.status] || STATUS_LABEL.applied;
  return `
  <div class="pm-card" style="padding:28px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font:700 12px var(--pm-font-body);color:#fff;background:${s.color};border-radius:100px;padding:4px 12px">${t(s.key)}</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-3)">${tf('monitor.status.appliedOn', { date: appliedDate(app.applied_at) })}</span>
    </div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${app.status === 'accepted'
      ? tf('monitor.status.acceptedBody', { link: `<a href="search.html" style="color:oklch(0.45 0.14 210);font-weight:700">${t('monitor.status.findLink')}</a>` })
      : app.status === 'rejected' ? t('monitor.status.rejectedBody')
      : t('monitor.status.appliedBody')}</p>
  </div>`;
}

async function render() {
  const session = await getSession();
  if (!session) {
    appEl.innerHTML = loginPromptHtml();
    return;
  }
  const [apps, left] = await Promise.all([getMyMonitorApplications(), getMonitorSlotsLeft()]);
  if (apps.length) {
    appEl.innerHTML = statusHtml(apps[0]);
    return;
  }
  if (left === 0) {
    appEl.innerHTML = `<div class="pm-card" style="padding:28px;text-align:center"><div style="font:700 16px var(--pm-font-body);margin-bottom:8px">${t('monitor.closed.title')}</div><p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${tf('monitor.closed.body', { cap: MONITOR_CAPACITY })}</p></div>`;
    return;
  }
  appEl.innerHTML = formHtml();
  if (left != null) {
    appEl.querySelector('.pm-card').insertAdjacentHTML('afterbegin', `<div style="font:700 13px var(--pm-font-body);color:oklch(0.45 0.14 160);margin-bottom:12px">${tf('monitor.slotsLeft', { left, cap: MONITOR_CAPACITY })}</div>`);
  }
  document.getElementById('f-submit').addEventListener('click', async () => {
    const errorEl = document.getElementById('f-error');
    const btn = document.getElementById('f-submit');
    const hasExistingPhotos = document.getElementById('f-has-photos').checked;
    errorEl.style.display = 'none';
    if (!hasExistingPhotos) {
      errorEl.textContent = t('monitor.form.photosRequired');
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
      errorEl.textContent = err.message || t('monitor.form.failed');
      errorEl.style.display = 'block';
      btn.disabled = false;
    }
  });
}

render();
