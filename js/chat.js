import { getMessages, sendMessage, subscribeToMessages, markRead } from './repo.js';

export function mountChatModal(container) {
  container.innerHTML = `
  <div class="pm-modal-overlay" id="chat-overlay">
    <div class="pm-modal-backdrop" id="chat-backdrop"></div>
    <div class="pm-modal-sheet pm-chat-sheet">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="chat-partner" style="font:700 15px var(--pm-font-body);color:oklch(0.24 0.02 245)"></div>
          <div id="chat-meta" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="chat-close">×</button>
      </div>
      <div class="pm-chat-body" id="chat-body"></div>
      <div class="pm-chat-input-row">
        <textarea class="pm-chat-input" id="chat-draft" rows="1" placeholder="メッセージを入力…"></textarea>
        <button class="pm-chat-send" id="chat-send" aria-label="送信">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  </div>`;

  const overlay = container.querySelector('#chat-overlay');
  const backdrop = container.querySelector('#chat-backdrop');
  const closeBtn = container.querySelector('#chat-close');
  const bodyEl = container.querySelector('#chat-body');
  const draftEl = container.querySelector('#chat-draft');
  const sendBtn = container.querySelector('#chat-send');
  const partnerEl = container.querySelector('#chat-partner');
  const metaEl = container.querySelector('#chat-meta');

  let bookingId = null;
  let role = 'client';
  let unsubscribe = null;

  function close() {
    overlay.classList.remove('is-open');
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  function timeLabel(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderMessages(messages) {
    if (!messages.length) {
      bodyEl.innerHTML = '<div class="pm-empty">まだメッセージはありません。<br>気軽にごあいさつしてみましょう。</div>';
      return;
    }
    bodyEl.innerHTML = messages.map((m) => {
      const mine = m.sender_role === role;
      return `<div class="pm-chat-row ${mine ? 'mine' : ''}">
        <div style="max-width:80%">
          <div class="pm-chat-bubble">${escapeHtml(m.text)}</div>
          <div class="pm-chat-meta">${mine ? 'あなた' : (role === 'client' ? 'カメラマン' : '依頼者')} ・ ${timeLabel(m.created_at)}</div>
        </div>
      </div>`;
    }).join('');
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let messages = [];

  async function send() {
    const text = draftEl.value.trim();
    if (!text || !bookingId) return;
    draftEl.value = '';
    try {
      await sendMessage(bookingId, role, text);
      await markRead(bookingId, role);
    } catch (err) {
      alert('送信に失敗しました。');
      console.error(err);
    }
  }
  sendBtn.addEventListener('click', send);
  draftEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  return {
    async open(id, chatRole, partnerLabel, bookingLabel) {
      bookingId = id;
      role = chatRole;
      partnerEl.textContent = partnerLabel;
      metaEl.textContent = (chatRole === 'client' ? 'カメラマンとのチャット' : '依頼者とのチャット') + ' ・ ' + bookingLabel;
      bodyEl.innerHTML = '<div class="pm-loading">読み込み中…</div>';
      overlay.classList.add('is-open');
      try {
        messages = await getMessages(id);
        renderMessages(messages);
        await markRead(id, role);
      } catch (err) {
        bodyEl.innerHTML = '<div class="pm-empty">メッセージの取得に失敗しました。</div>';
        console.error(err);
      }
      if (unsubscribe) unsubscribe();
      unsubscribe = subscribeToMessages(id, (msg) => {
        messages = [...messages, msg];
        renderMessages(messages);
        if (overlay.classList.contains('is-open')) markRead(id, role);
      });
    },
    close,
  };
}
