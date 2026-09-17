// コラム記事の個別ページを js/data.js から生成する。
//
// 以前は全7記事が article.html?id=◯◯ という1つのURLを共有し、本文を
// JavaScript で差し込んでいたため、検索エンジンからは「中身の違う7記事」
// ではなく「1ページ」に見えていた。記事ごとに独立したHTMLを出力し、
// title / description / 構造化データを記事単位で持たせる。
//
// 記事の内容は js/data.js の COLUMN_ARTICLES が唯一の出典。
// 記事を追加・修正したら、このスクリプトを実行して出力を更新する:
//     node scripts/build-articles.mjs
//
// 生成物（column-<id>.html）は手で編集しないこと。次回実行で上書きされる。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLUMN_ARTICLES, FAQS } from '../js/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://photo-match.jp';
const DESC_LIMIT = 110;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// meta description は全文ではなく冒頭を使う。長すぎると検索結果で
// 途中で切られ、かえって内容が伝わらないため。
const summarize = (text) => {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length <= DESC_LIMIT ? t : t.slice(0, DESC_LIMIT - 1) + '…';
};

const pageFor = (id) => `column-${id}.html`;

function relatedHtml(current) {
  const others = COLUMN_ARTICLES.filter((a) => a.id !== current.id).slice(0, 3);
  return `
  <section class="pm-wrap-narrow" style="padding:0 clamp(20px,5vw,32px)">
    <h2 style="font:700 17px var(--pm-font-body);margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid var(--pm-border-soft)">ほかのコラム</h2>
    <div style="display:flex;flex-direction:column;gap:12px">
${others.map((a) => `      <a href="${pageFor(a.id)}" class="pm-card" style="display:block;padding:16px 18px;text-decoration:none;color:inherit">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
          <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:3px 10px;border-radius:100px">${esc(a.tag)}</span>
          <span style="font:11px var(--pm-font-body);color:var(--pm-text-muted)">読了 約${a.readMin}分</span>
        </div>
        <div style="font:700 15px/1.6 var(--pm-font-body)">${esc(a.title)}</div>
      </a>`).join('\n')}
    </div>
  </section>`;
}

function render(article) {
  const url = `${SITE}/${pageFor(article.id)}`;
  const desc = summarize(article.lead);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: desc,
    inLanguage: 'ja',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'PhotoMatch' },
    publisher: {
      '@type': 'Organization',
      name: 'PhotoMatch',
      logo: { '@type': 'ImageObject', url: `${SITE}/assets/photomatch-logo-full-transparent.png` },
    },
    articleSection: article.tag,
  };

  return `<!DOCTYPE html>
<html lang="ja">
<!-- このファイルは scripts/build-articles.mjs が生成しています。直接編集しないでください。 -->
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(article.title)} | PhotoMatch</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(article.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="PhotoMatch">
<meta property="og:image" content="${SITE}/assets/photomatch-logo-full.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/photomatch-icon-transparent.png">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
</head>
<body>

<header class="pm-header" id="pm-header"></header>

<main>
  <section class="pm-wrap-narrow" style="padding:24px clamp(20px,5vw,32px) 0">
    <a class="pm-back-link" href="column.html">← コラム一覧に戻る</a>
  </section>

  <article class="pm-wrap-narrow" style="padding:20px clamp(20px,5vw,32px) 0">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:4px 10px;border-radius:100px">${esc(article.tag)}</span>
      <span style="font:12px var(--pm-font-body);color:var(--pm-text-muted)">読了 約${article.readMin}分</span>
    </div>
    <h1 style="font:700 clamp(24px,5vw,32px)/1.5 var(--pm-font-body);margin:0 0 20px">${esc(article.title)}</h1>
    <div style="font:15px/1.9 var(--pm-font-body);color:oklch(0.32 0.02 235);background:oklch(0.97 0.015 210);border-left:3px solid oklch(0.7 0.12 210);border-radius:0 12px 12px 0;padding:18px 20px;margin-bottom:36px">${esc(article.lead)}</div>
${article.sections.map((s) => `    <div style="margin-bottom:36px">
      <h2 style="font:700 19px var(--pm-font-body);margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid var(--pm-border-soft)">${esc(s.h)}</h2>
      <p style="font:14px/1.9 var(--pm-font-body);color:var(--pm-text-2);margin:0">${esc(s.b)}</p>
    </div>`).join('\n')}
  </article>

  <section style="max-width:800px;margin:48px auto 0;padding:0 clamp(20px,5vw,32px) 48px">
    <div style="background:linear-gradient(135deg, oklch(0.28 0.04 240), oklch(0.36 0.08 228));color:#fff;border-radius:20px;padding:clamp(32px,7vw,48px) clamp(24px,5vw,40px);text-align:center">
      <div style="font:700 13px var(--pm-font-body);color:oklch(0.78 0.1 200);letter-spacing:0.06em;margin-bottom:10px">READY?</div>
      <h2 style="font:700 clamp(20px,4.5vw,26px)/1.6 var(--pm-font-body);margin:0 0 14px">その一枚、プロと45分で。</h2>
      <p style="font:14px/1.9 var(--pm-font-body);color:oklch(0.85 0.01 220);margin:0 0 28px">名古屋・岐阜・一宮エリアの審査済みカメラマンが、アプリ映えする自然な1枚を撮影します。</p>
      <a class="pm-btn pm-btn-primary pm-btn-lg" style="background:#fff;color:oklch(0.24 0.05 245)" href="search.html">撮影を予約する</a>
    </div>
  </section>
${relatedHtml(article)}
  <div style="height:80px"></div>
</main>

<footer class="pm-footer" id="pm-footer"></footer>

<script type="module" src="js/pages/column-article.js"></script>
</body>
</html>
`;
}

let count = 0;
for (const article of COLUMN_ARTICLES) {
  writeFileSync(join(ROOT, pageFor(article.id)), render(article));
  console.log(`  ${pageFor(article.id)}  ${article.title}`);
  count++;
}
console.log(`${count} 記事を生成しました。`);

// ---------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------
// 記事が増減するたびに手で直すと必ず漏れるので、記事一覧から生成する。
// 会員向け・運営向けページ（マイページ、予約フロー、管理画面など）は
// 各HTMLで noindex にしてあるため、ここには載せない。
const STATIC_PAGES = [
  { path: '', priority: '1.0', changefreq: 'weekly' },
  { path: 'search.html', priority: '0.9', changefreq: 'weekly' },
  { path: 'column.html', priority: '0.8', changefreq: 'weekly' },
  { path: 'meeting-points.html', priority: '0.7', changefreq: 'monthly' },
  { path: 'terms.html', priority: '0.3', changefreq: 'yearly' },
];

const today = new Date().toISOString().slice(0, 10);
const urls = [
  ...STATIC_PAGES.map((p) => ({ loc: `${SITE}/${p.path}`, priority: p.priority, changefreq: p.changefreq })),
  ...COLUMN_ARTICLES.map((a) => ({ loc: `${SITE}/${pageFor(a.id)}`, priority: '0.8', changefreq: 'monthly' })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- scripts/build-articles.mjs が生成しています。直接編集しないでください。 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml を生成しました（${urls.length} URL）。`);

// ---------------------------------------------------------------
// index.html の FAQ 構造化データ
// ---------------------------------------------------------------
// FAQ本文は data.js が出典で、画面にはJavaScriptで描画している。
// 構造化データは静的に置く必要があるため、マーカーの間に差し込む。
const FAQ_BEGIN = '<!-- BEGIN generated:faq-jsonld -->';
const FAQ_END = '<!-- END generated:faq-jsonld -->';

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const indexPath = join(ROOT, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8');
const begin = indexHtml.indexOf(FAQ_BEGIN);
const end = indexHtml.indexOf(FAQ_END);
if (begin === -1 || end === -1) {
  console.error('index.html に FAQ 構造化データのマーカーが見つかりません。スキップしました。');
} else {
  const block = `${FAQ_BEGIN}\n<script type="application/ld+json">\n${JSON.stringify(faqLd, null, 2)}\n</script>\n${FAQ_END}`;
  writeFileSync(indexPath, indexHtml.slice(0, begin) + block + indexHtml.slice(end + FAQ_END.length));
  console.log(`index.html に FAQ 構造化データを差し込みました（${FAQS.length} 問）。`);
}
