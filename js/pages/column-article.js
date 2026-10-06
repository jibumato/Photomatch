// 生成済みのコラム記事ページ（column-<id>.html）用。
// 本文は静的HTMLとして出力済みなので、共通ヘッダー／フッターを差し込むだけ。
// 英語表示（localStorage pm_lang === 'en'）のときだけ、読み込み後に本文を
// js/i18n/columns-en.js の英訳へ差し替える。生成HTML自体は日本語のまま
// （title / description / 構造化データを日本語で検索エンジンに見せるため）。
import { mountLayout } from '../layout.js';
import { getLang, applyI18n } from '../i18n.js';
import { tagText, readMinText } from '../i18n/columns.js';
import { COLUMN_EN } from '../i18n/columns-en.js';

mountLayout();

const DESC_LIMIT = 155;
const summarize = (text) => {
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length <= DESC_LIMIT) return s;
  const cut = s.slice(0, DESC_LIMIT - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length) + '…';
};

function setText(el, text) {
  if (el && text) el.textContent = text;
}

function applyEnglish() {
  applyI18n();
  document.querySelectorAll('[data-col-tag]').forEach((el) => { el.textContent = tagText(el.textContent.trim()); });
  document.querySelectorAll('[data-col-readmin]').forEach((el) => {
    el.textContent = readMinText(el.getAttribute('data-col-readmin'));
  });

  const art = document.querySelector('[data-col-article]');
  const en = art && COLUMN_EN[art.getAttribute('data-col-article')];
  if (en) {
    setText(art.querySelector('[data-col-title]'), en.title);
    setText(art.querySelector('[data-col-lead]'), en.lead);
    (en.sections || []).forEach((s, i) => {
      setText(art.querySelector(`[data-col-h="${i}"]`), s.h);
      setText(art.querySelector(`[data-col-b="${i}"]`), s.b);
    });
    document.title = `${en.title} | PhotoMatch`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', summarize(en.lead));
  }
  document.querySelectorAll('[data-col-card]').forEach((card) => {
    const rel = COLUMN_EN[card.getAttribute('data-col-card')];
    if (rel) setText(card.querySelector('[data-col-title]'), rel.title);
  });
}

if (getLang() === 'en') applyEnglish();
