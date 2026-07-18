import { COUNSELING_QUESTIONS } from './data.js';
import { getCounselingSheet, saveCounselingSheet } from './repo.js';

const CHIP_BASE = 'padding:9px 16px;border-radius:100px;border:1px solid var(--pm-border);background:#fff;font:600 13px var(--pm-font-body);cursor:pointer;color:oklch(0.32 0.02 240)';
const CHIP_ACTIVE = 'padding:9px 16px;border-radius:100px;border:1px solid transparent;background:var(--pm-brand-grad);font:700 13px var(--pm-font-body);cursor:pointer;color:#fff';

export function mountSheetModal(container) {
  container.innerHTML = `
  <div class="pm-modal-overlay" id="sheet-overlay">
    <div class="pm-modal-backdrop" id="sheet-backdrop"></div>
    <div class="pm-modal-sheet pm-sheet-modal">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div style="font:700 16px var(--pm-font-body);color:oklch(0.24 0.02 245)">事前カウンセリングシート</div>
          <div id="sheet-booking-label" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="sheet-close">×</button>
      </div>
      <div class="pm-sheet-body">
        <p style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 20px;padding:12px 14px;background:oklch(0.97 0.015 210);border-radius:12px">よろしければ撮影についてお聞かせください。すべて任意です。わかる範囲でご記入いただくと、当日の撮影がよりスムーズになります。</p>
        <div id="sheet-questions" style="display:flex;flex-direction:column;gap:24px"></div>
      </div>
      <div class="pm-sheet-foot">
        <button class="pm-btn" style="flex:1;background:#fff;border:1px solid var(--pm-border);border-radius:100px;padding:13px;font:600 14px var(--pm-font-body);color:var(--pm-text-2)" id="sheet-later">あとで</button>
        <button class="pm-btn" style="flex:2;background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:13px;font:700 14px var(--pm-font-body);color:#fff" id="sheet-save">回答を保存する</button>
      </div>
    </div>
  </div>`;

  const overlay = container.querySelector('#sheet-overlay');
  const backdrop = container.querySelector('#sheet-backdrop');
  const closeBtn = container.querySelector('#sheet-close');
  const laterBtn = container.querySelector('#sheet-later');
  const saveBtn = container.querySelector('#sheet-save');
  const questionsEl = container.querySelector('#sheet-questions');
  const labelEl = container.querySelector('#sheet-booking-label');

  let draft = {};
  let currentBookingId = null;

  function close() { overlay.classList.remove('is-open'); }
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  laterBtn.addEventListener('click', close);

  function renderQuestions() {
    questionsEl.innerHTML = COUNSELING_QUESTIONS.map((q) => {
      if (q.type === 'text') {
        const val = draft[q.id] || '';
        return `<div>
          <div style="font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 240);margin-bottom:10px">${q.label}</div>
          <textarea data-qid="${q.id}" class="sheet-text" rows="2" placeholder="${q.placeholder || ''}" style="width:100%;resize:none;border:1px solid var(--pm-border-soft);border-radius:12px;padding:11px 14px;font:13px/1.6 var(--pm-font-body);background:#fff">${val}</textarea>
        </div>`;
      }
      const current = draft[q.id];
      const chips = q.options.map((opt) => {
        const active = q.type === 'multi' ? Array.isArray(current) && current.includes(opt) : current === opt;
        return `<span data-qid="${q.id}" data-opt="${opt}" data-kind="${q.type}" class="sheet-chip" style="${active ? CHIP_ACTIVE : CHIP_BASE}">${opt}</span>`;
      }).join('');
      return `<div>
        <div style="font:700 13px var(--pm-font-body);color:oklch(0.3 0.02 240);margin-bottom:10px">${q.label}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${chips}</div>
      </div>`;
    }).join('');

    questionsEl.querySelectorAll('.sheet-text').forEach((el) => {
      el.addEventListener('input', (e) => { draft[e.target.dataset.qid] = e.target.value; });
    });
    questionsEl.querySelectorAll('.sheet-chip').forEach((el) => {
      el.addEventListener('click', () => {
        const { qid, opt, kind } = el.dataset;
        if (kind === 'multi') {
          const cur = Array.isArray(draft[qid]) ? draft[qid] : [];
          draft[qid] = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
        } else {
          draft[qid] = draft[qid] === opt ? '' : opt;
        }
        renderQuestions();
      });
    });
  }

  saveBtn.addEventListener('click', async () => {
    if (!currentBookingId) return;
    saveBtn.disabled = true;
    try {
      await saveCounselingSheet(currentBookingId, draft);
      close();
    } catch (err) {
      alert('保存に失敗しました。時間をおいて再度お試しください。');
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  return {
    async open(bookingId, label) {
      currentBookingId = bookingId;
      labelEl.textContent = label || '';
      draft = {};
      try {
        const existing = await getCounselingSheet(bookingId);
        if (existing && existing.answers) draft = { ...existing.answers };
      } catch (err) { console.error(err); }
      renderQuestions();
      overlay.classList.add('is-open');
    },
  };
}
