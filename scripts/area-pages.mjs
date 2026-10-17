// エリア別のランディングページ（nagoya.html / gifu.html）を js/data.js から生成する。
//
// 「名古屋 マッチングアプリ 写真」「岐阜 プロフィール写真 撮影」のような地域名つきの
// 検索に、そのエリアの内容だけを書いたページで応えるため。本文（料金・季節の
// ロケーション・集合場所・撮影の流れ）は静的HTMLとして出力し、JavaScript を
// 実行しないクローラーにも読めるようにする。
//
// 内容の出典は js/data.js（AREA_PAGES / PRICING_PLANS / SEASONAL_LOCATIONS /
// MEETING_POINTS / HOW_IT_WORKS / FAQS）。scripts/build-articles.mjs から呼ばれ、
// サイトマップにも載る。生成物は手で編集しないこと。

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AREAS, AREA_PAGES, PRICING_PLANS, SEASONS, SEASONAL_LOCATIONS, MEETING_POINTS, HOW_IT_WORKS, FAQS, COLUMN_ARTICLES,
} from '../js/data.js';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const areaPageFor = (key) => `${key}.html`;

function spotCard(spot) {
  const season = SEASONS.find((s) => s.key === spot.season);
  return `      <div class="pm-card pm-loc-card" data-season="${spot.season}">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <span class="pm-loc-season"><span aria-hidden="true">${season.icon}</span>${esc(season.label)}　${esc(season.range)}</span>
        </div>
        <h3 style="font:700 16px/1.5 var(--pm-font-body);margin:0 0 4px">${esc(spot.name)}</h3>
        ${spot.note ? `<div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-bottom:8px">※${esc(spot.note)}</div>` : ''}
        <div style="font:700 14px/1.7 var(--pm-font-body);color:oklch(0.35 0.03 235);margin:6px 0">${esc(spot.catch)}</div>
        <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 12px">${esc(spot.desc)}</p>
        ${spot.access ? `<div style="font:12px/1.7 var(--pm-font-body);color:oklch(0.42 0.1 215);background:var(--pm-bg-mint);border-radius:10px;padding:8px 10px;margin-bottom:12px">${esc(spot.access)}</div>` : ''}
        <a href="${esc(spot.mapUrl)}" target="_blank" rel="noopener noreferrer" style="margin-top:auto;font:700 13px var(--pm-font-body);color:oklch(0.45 0.14 210);text-decoration:underline">Googleマップで見る ↗</a>
      </div>`;
}

function render(page, SITE) {
  const area = AREAS.find((a) => a.key === page.key);
  const spots = SEASONAL_LOCATIONS.find((l) => l.key === page.key).spots;
  const mp = MEETING_POINTS.find((m) => area.label.startsWith(m.label));
  const url = `${SITE}/${areaPageFor(page.key)}`;
  const searchUrl = `search.html?area=${encodeURIComponent(area.label)}`;
  const others = AREA_PAGES.filter((p) => p.key !== page.key);
  const faqs = FAQS.slice(0, 4);
  // 関連コラム：そのエリアのコラムを先に、残りは一覧の順で3本。
  const columns = [...COLUMN_ARTICLES]
    .sort((a, b) => (b.tag === page.columnTag) - (a.tag === page.columnTag) || a.priority - b.priority)
    .slice(0, 3);
  const minPrice = Math.min(...PRICING_PLANS.map((p) => Number(p.price.replace(/,/g, ''))));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${url}#service`,
      name: page.h1,
      serviceType: 'マッチングアプリ用プロフィール写真の出張撮影',
      description: page.description,
      url,
      provider: { '@id': `${SITE}/#business` },
      areaServed: { '@type': 'City', name: page.city },
      offers: PRICING_PLANS.map((p) => ({
        '@type': 'Offer', name: p.name, price: p.price.replace(/,/g, ''), priceCurrency: 'JPY', description: p.desc,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'トップ', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: `${page.name}エリア`, item: url },
      ],
    },
  ];

  return `<!DOCTYPE html>
<html lang="ja">
<!-- このファイルは scripts/area-pages.mjs が生成しています。直接編集しないでください。 -->
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="PhotoMatch">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/photomatch-icon-transparent.png">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
${jsonLd.map((ld) => `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`).join('\n')}
</head>
<body>

<header class="pm-header" id="pm-header"></header>

<main>
  <section class="pm-wrap-mid" style="padding:20px clamp(20px,5vw,32px) 0">
    <nav aria-label="パンくずリスト" style="font:12px var(--pm-font-body);color:var(--pm-text-3)">
      <a href="./" style="text-decoration:underline">トップ</a> ＞ <span aria-current="page">${esc(page.name)}エリア</span>
    </nav>
  </section>

  <section class="pm-wrap-mid" style="padding:20px clamp(20px,5vw,32px) 8px">
    <div class="pm-eyebrow" style="text-align:left">${esc(page.eyebrow)}</div>
    <h1 style="font:700 clamp(24px,5.5vw,34px)/1.45 var(--pm-font-body);margin:0 0 16px">${esc(page.h1)}</h1>
    <p style="font:15px/1.9 var(--pm-font-body);color:var(--pm-text-2);margin:0 0 20px">${esc(page.lead)}</p>
    <ul style="list-style:none;padding:0;margin:0 0 24px;display:flex;flex-wrap:wrap;gap:8px">
      <li class="pm-badge" style="font-size:12px;padding:6px 12px">撮影45分</li>
      <li class="pm-badge" style="font-size:12px;padding:6px 12px">¥${minPrice.toLocaleString()}〜（税込）</li>
      <li class="pm-badge" style="font-size:12px;padding:6px 12px">通常3営業日以内に納品</li>
      <li class="pm-badge" style="font-size:12px;padding:6px 12px">審査済みカメラマン</li>
      <li class="pm-badge" style="font-size:12px;padding:6px 12px">マッチング数保証</li>
    </ul>
    <a class="pm-btn pm-btn-primary pm-btn-lg" href="${searchUrl}">${esc(page.name)}エリアの空き枠を見る</a>
    <div style="font:12px var(--pm-font-body);color:var(--pm-text-3);margin-top:8px">空き枠の確認は会員登録なしでできます</div>
  </section>

  <section class="pm-wrap" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">${esc(page.name)}の季節のおすすめロケーション</h2>
    <p class="pm-section-sub" style="margin-bottom:24px">${esc(page.spotsLead)}</p>
    <div class="pm-loc-grid">
${spots.map(spotCard).join('\n')}
    </div>
    <p style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:16px 0 0;text-align:center">※撮影場所は、季節や天候に合わせて、ご予約後にカメラマンとご相談ください。</p>
  </section>

  <section class="pm-wrap-mid" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">料金プラン</h2>
    <p class="pm-section-sub" style="margin-bottom:24px">表示価格はすべて税込です。当日の追加料金はかかりません。</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
${PRICING_PLANS.map((p) => `      <a href="search.html?area=${encodeURIComponent(area.label)}&amp;plan=${encodeURIComponent(p.name)}" class="pm-card" style="display:block;padding:20px;text-decoration:none;color:inherit">
        <h3 style="font:700 15px var(--pm-font-body);margin:0 0 6px">${esc(p.name)}</h3>
        ${p.originalPrice ? `<div style="font:600 13px var(--pm-font-num);color:var(--pm-text-muted)"><s>¥${esc(p.originalPrice)}</s> <span style="color:var(--pm-warn-text);font-weight:700">${esc(p.discountLabel)}</span></div>` : ''}
        <div style="font:800 24px var(--pm-font-num);margin:2px 0 6px">¥${esc(p.price)}</div>
        <div style="font:13px/1.7 var(--pm-font-body);color:var(--pm-text-3)">${esc(p.desc)}</div>
      </a>`).join('\n')}
    </div>
  </section>

  <section class="pm-wrap-mid" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">集合場所</h2>
    <div class="pm-card" style="overflow:hidden;margin-top:20px">
      <div style="padding:20px 24px 16px">
        <h3 style="font:700 16px var(--pm-font-body);margin:0 0 6px">${esc(mp.label)}エリアの集合場所</h3>
        <p style="font:14px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${esc(mp.detail)}</p>
      </div>
      <iframe title="${esc(mp.label)}エリアの集合場所の地図" src="https://www.google.com/maps?q=${encodeURIComponent(mp.mapQuery)}&amp;output=embed" width="100%" height="240" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
    <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:12px 0 0">当日の流れ・持ち物・服装は<a href="meeting-points.html" style="color:oklch(0.45 0.14 210);text-decoration:underline">集合場所・撮影当日の案内</a>をご覧ください。</p>
  </section>

  <section class="pm-wrap-mid" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">予約から納品までの流れ</h2>
    <ol style="list-style:none;padding:0;margin:24px 0 0;display:flex;flex-direction:column;gap:12px">
${HOW_IT_WORKS.map((s) => `      <li class="pm-card" style="padding:18px 20px">
        <h3 style="font:700 15px var(--pm-font-body);margin:0 0 6px"><span style="font:800 14px var(--pm-font-num);color:oklch(0.5 0.14 210);margin-right:8px">${esc(s.step)}</span>${esc(s.title)}</h3>
        <p style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0">${esc(s.desc)}</p>
      </li>`).join('\n')}
    </ol>
  </section>

  <section class="pm-wrap-mid" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">よくある質問</h2>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">
${faqs.map((f) => `      <details class="pm-card pm-faq-item" style="border-radius:14px;overflow:hidden">
        <summary class="pm-faq-q"><span style="font:700 15px var(--pm-font-body);color:oklch(0.28 0.02 240)">${esc(f.q)}</span><span class="pm-faq-icon" style="font:600 18px var(--pm-font-num);color:oklch(0.6 0.12 210);flex-shrink:0"></span></summary>
        <div style="font:13px/1.9 var(--pm-font-body);color:var(--pm-text-3);padding:0 20px 18px">${esc(f.a)}</div>
      </details>`).join('\n')}
    </div>
    <p style="font:13px var(--pm-font-body);margin:14px 0 0;text-align:center"><a href="./#faq-section" style="color:oklch(0.45 0.14 210);text-decoration:underline">ほかの質問を見る</a></p>
  </section>

  <section class="pm-wrap-mid" style="padding:clamp(40px,8vw,56px) clamp(20px,5vw,32px) 0">
    <h2 class="pm-section-title">関連コラム</h2>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
${columns.map((a) => `      <a href="column-${a.id}.html" class="pm-card" style="display:block;padding:16px 18px;text-decoration:none;color:inherit">
        <span style="font:700 11px var(--pm-font-body);color:oklch(0.48 0.1 210);background:oklch(0.95 0.03 205);padding:3px 10px;border-radius:100px">${esc(a.tag)}</span>
        <h3 style="font:700 15px/1.6 var(--pm-font-body);margin:8px 0 0">${esc(a.title)}</h3>
      </a>`).join('\n')}
    </div>
  </section>

  <section style="max-width:900px;margin:56px auto 0;padding:0 clamp(20px,5vw,32px) 24px">
    <div style="background:linear-gradient(135deg, oklch(0.28 0.04 240), oklch(0.36 0.08 228));color:#fff;border-radius:20px;padding:clamp(32px,7vw,48px) clamp(24px,5vw,40px);text-align:center">
      <h2 style="font:700 clamp(20px,4.5vw,26px)/1.6 var(--pm-font-body);margin:0 0 14px">${esc(page.ctaTitle)}</h2>
      <p style="font:14px/1.9 var(--pm-font-body);color:oklch(0.85 0.01 220);margin:0 0 24px">空き枠カレンダーから、ご都合のよい日時をお選びください。</p>
      <a class="pm-btn pm-btn-primary pm-btn-lg" style="background:#fff;color:oklch(0.24 0.05 245)" href="${searchUrl}">${esc(page.name)}エリアの空き枠を見る</a>
    </div>
    <p style="font:13px var(--pm-font-body);color:var(--pm-text-3);margin:20px 0 0;text-align:center">ほかの対応エリア：${others.map((o) => `<a href="${areaPageFor(o.key)}" style="color:oklch(0.45 0.14 210);text-decoration:underline">${esc(o.name)}</a>`).join('・')}</p>
  </section>
  <div style="height:56px"></div>
</main>

<footer class="pm-footer" id="pm-footer"></footer>

<script type="module" src="js/pages/area.js"></script>
</body>
</html>
`;
}

// 生成したページのパス（サイトマップ用）を返す。
export function buildAreaPages(ROOT, SITE) {
  return AREA_PAGES.map((page) => {
    const path = areaPageFor(page.key);
    writeFileSync(join(ROOT, path), render(page, SITE));
    console.log(`  ${path}  ${page.title}`);
    return path;
  });
}
