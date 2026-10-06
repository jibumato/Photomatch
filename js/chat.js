import { t, getLang } from './i18n.js';
import { jaText } from './i18n/mypage.js';
import { getMessages, sendMessage, subscribeToMessages, markRead, notifyNewMessage } from './repo.js';

// onClose: called after the modal closes (pages refresh their unread badges).
// The chat is shared with the photographer/ops screens, which stay Japanese:
// only the customer's side ('client') follows the visitor's language.
export function mountChatModal(container, { onClose } = {}) {
  container.innerHTML = `
  <div class="pm-modal-overlay" id="chat-overlay">
    <div class="pm-modal-backdrop" id="chat-backdrop"></div>
    <div class="pm-modal-sheet pm-chat-sheet">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="chat-partner" style="font:700 15px var(--pm-font-body);color:oklch(0.24 0.02 245)"></div>
          <div id="chat-meta" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="chat-close" aria-label="${t('chat.close')}">×</button>
      </div>
      <div class="pm-chat-body" id="chat-body"></div>
      <div class="pm-chat-input-row">
        <textarea class="pm-chat-input" id="chat-draft" rows="1" placeholder="${t('chat.placeholder')}"></textarea>
        <button class="pm-chat-send" id="chat-send" aria-label="${t('chat.send')}">
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
  const tr = (key) => (role === 'client' ? t(key) : jaText(key));
  const dot = () => (role === 'client' && getLang() === 'en' ? '·' : '・');
  let unsubscribe = null;

  function close() {
    const wasOpen = overlay.classList.contains('is-open');
    overlay.classList.remove('is-open');
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (wasOpen && onClose) onClose();
  }
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  function timeLabel(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderMessages(messages) {
    if (!messages.length) {
      bodyEl.innerHTML = `<div class="pm-empty">${tr('chat.empty')}</div>`;
      return;
    }
    bodyEl.innerHTML = messages.map((m) => {
      const mine = m.sender_role === role;
      return `<div class="pm-chat-row ${mine ? 'mine' : ''}">
        <div style="max-width:80%">
          <div class="pm-chat-bubble">${escapeHtml(m.text)}</div>
          <div class="pm-chat-meta">${mine ? tr('chat.you') : (role === 'client' ? tr('chat.photographer') : tr('chat.client'))} ${dot()} ${timeLabel(m.created_at)}</div>
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
      notifyNewMessage(bookingId);
    } catch (err) {
      alert(tr('chat.sendFailed'));
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
      const sep = ` ${dot()} `;
      metaEl.textContent = (chatRole === 'client' ? tr('chat.withPhotographer') : tr('chat.withClient')) + sep + bookingLabel;
      draftEl.placeholder = tr('chat.placeholder');
      sendBtn.setAttribute('aria-label', tr('chat.send'));
      closeBtn.setAttribute('aria-label', tr('chat.close'));
      bodyEl.innerHTML = `<div class="pm-loading">${tr('chat.loading')}</div>`;
      overlay.classList.add('is-open');
      try {
        messages = await getMessages(id);
        renderMessages(messages);
        await markRead(id, role);
      } catch (err) {
        bodyEl.innerHTML = `<div class="pm-empty">${tr('chat.loadFailed')}</div>`;
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
