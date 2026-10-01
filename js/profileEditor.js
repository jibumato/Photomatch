// カメラマン管理画面の「プロフィール設定」フォーム。
// 書き込める列は supabase/schema.sql の grant で絞ってあり（公開状態・評価などは
// 運営のみ）、写真は公開バケットの自分のフォルダにだけ置ける。
import { updateMyPhotographer, uploadProfilePhoto, removeProfilePhoto } from './repo.js';
import { AREAS } from './data.js';
import { escapeHtml, safePhotoUrl } from './util.js';

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 1200;

// Shrinks to MAX_SIDE and re-encodes as JPEG, so a multi-megabyte phone photo
// fits the bucket's 2MB limit and loads quickly on the listing pages.
async function resizeToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.85);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function statusHtml(visible) {
  return visible
    ? '<span style="background:oklch(0.94 0.06 160);color:oklch(0.4 0.12 160);font:700 11px var(--pm-font-body);padding:3px 10px;border-radius:100px">公開中</span>'
    : '<span style="background:oklch(0.95 0.05 85);color:oklch(0.5 0.13 75);font:700 11px var(--pm-font-body);padding:3px 10px;border-radius:100px">非公開</span>';
}

function previewStyle(url) {
  return url
    ? `background-image:url(${url});background-size:cover;background-position:center`
    : 'background:repeating-linear-gradient(135deg, oklch(0.9 0.05 200) 0px, oklch(0.9 0.05 200) 12px, oklch(0.96 0.03 210) 12px, oklch(0.96 0.03 210) 24px)';
}

function formHtml(p) {
  const areaOptions = ['<option value="" disabled' + (AREAS.some((a) => a.label === p.area) ? '' : ' selected') + '>選択してください</option>']
    .concat(AREAS.map((a) => `<option value="${escapeHtml(a.label)}" ${a.label === p.area ? 'selected' : ''}>${escapeHtml(a.label)}</option>`)).join('');
  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <div style="font:700 15px var(--pm-font-body)">プロフィール設定</div>
      <span id="pf-status">${statusHtml(p.is_visible !== false)}</span>
    </div>
    <p id="pf-status-note" style="font:13px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 16px">${p.is_visible !== false
      ? '検索ページ・プロフィールページに公開されています。保存した内容はすぐに反映されます。'
      : 'いまは検索ページに表示されていません。内容を保存したあと、運営が確認して公開します。'}</p>
    <div style="display:flex;flex-direction:column;gap:16px;max-width:520px">
      <div class="pm-field">
        <label>プロフィール写真</label>
        <div id="pf-photo-preview" style="aspect-ratio:4/3;max-width:320px;border-radius:12px;border:1px solid var(--pm-border);${previewStyle(safePhotoUrl(p.photo_url))}"></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px">
          <label class="pm-btn-outline" for="pf-photo" style="cursor:pointer;display:inline-block">写真を選ぶ</label>
          <input type="file" id="pf-photo" accept="image/jpeg,image/png,image/webp" style="display:none">
          <span id="pf-photo-note" style="font:12px var(--pm-font-body);color:var(--pm-text-3)">保存すると反映されます</span>
        </div>
        <div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-top:6px">顔が中央に写った、明るい写真がおすすめです。大きな写真は自動で縮小されます。</div>
      </div>
      <div class="pm-field">
        <label>表示名</label>
        <input class="pm-input" type="text" id="pf-name" maxlength="40" value="${escapeHtml(p.name || '')}">
      </div>
      <div class="pm-field">
        <label>活動エリア</label>
        <select class="pm-select" id="pf-area">${areaOptions}</select>
      </div>
      <div class="pm-field">
        <label>性別（「女性カメラマンのみ」の絞り込みに使われます）</label>
        <select class="pm-select" id="pf-gender">
          <option value="" disabled ${p.gender ? '' : 'selected'}>選択してください</option>
          <option value="male" ${p.gender === 'male' ? 'selected' : ''}>男性</option>
          <option value="female" ${p.gender === 'female' ? 'selected' : ''}>女性</option>
        </select>
      </div>
      <div class="pm-field">
        <label>ひとこと（検索結果のカードに表示されます）</label>
        <input class="pm-input" type="text" id="pf-comment" maxlength="120" value="${escapeHtml(p.price_comment || '')}" placeholder="例）緊張しやすい方こそ、まずは気軽にご相談ください！">
      </div>
      <div class="pm-field">
        <label>紹介文</label>
        <textarea class="pm-textarea" id="pf-bio" rows="5" maxlength="600" placeholder="得意な撮影スタイルや、撮影の進め方など">${escapeHtml(p.bio || '')}</textarea>
      </div>
      <div class="pm-field">
        <label>Instagram（任意・ユーザー名のみ）</label>
        <input class="pm-input" type="text" id="pf-instagram" maxlength="31" value="${escapeHtml(p.instagram || '')}" placeholder="例）photomatch_nagoya">
      </div>
      <label style="display:flex;align-items:center;gap:8px;font:13px var(--pm-font-body);cursor:pointer">
        <input type="checkbox" id="pf-english" ${p.speaks_english ? 'checked' : ''}>
        <span>英語での撮影に対応できる</span>
      </label>
      <div id="pf-english-fields" style="display:${p.speaks_english ? 'flex' : 'none'};flex-direction:column;gap:16px">
        <div class="pm-field">
          <label>ひとこと（英語・任意）</label>
          <input class="pm-input" type="text" id="pf-comment-en" maxlength="240" value="${escapeHtml(p.price_comment_en || '')}">
        </div>
        <div class="pm-field">
          <label>紹介文（英語・任意）</label>
          <textarea class="pm-textarea" id="pf-bio-en" rows="4" maxlength="1200">${escapeHtml(p.bio_en || '')}</textarea>
        </div>
        <div style="font:12px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-top:-8px">未入力の場合、英語表示でも日本語の文章が表示されます。</div>
      </div>
      <div class="pm-error-text" id="pf-error" style="display:none"></div>
      <button class="pm-btn pm-btn-primary" id="pf-save" style="align-self:flex-start">保存する</button>
      <div id="pf-saved-note" style="display:none;font:12px var(--pm-font-body);color:oklch(0.5 0.14 160)">保存しました。</div>
    </div>`;
}

// `current` is the photographers row; userId is the auth uid (the storage
// folder name — differs from photographer.id for rows linked after the fact).
export function mountProfileEditor(el, current, userId) {
  let photographer = current;
  let pendingBlob = null;
  el.innerHTML = formHtml(photographer);

  const $ = (id) => document.getElementById(id);
  const errorEl = $('pf-error');
  const showError = (msg) => { errorEl.textContent = msg; errorEl.style.display = 'block'; };

  $('pf-english').addEventListener('change', (e) => {
    $('pf-english-fields').style.display = e.target.checked ? 'flex' : 'none';
  });

  $('pf-photo').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    errorEl.style.display = 'none';
    $('pf-saved-note').style.display = 'none';
    if (file.size > MAX_SOURCE_BYTES) { showError('写真のサイズが大きすぎます（20MBまで）。'); return; }
    try {
      pendingBlob = await resizeToJpeg(file);
      const previewUrl = URL.createObjectURL(pendingBlob);
      $('pf-photo-preview').setAttribute('style', `aspect-ratio:4/3;max-width:320px;border-radius:12px;border:1px solid var(--pm-border);${previewStyle(previewUrl)}`);
      $('pf-photo-note').textContent = '「保存する」を押すと反映されます';
    } catch (err) {
      pendingBlob = null;
      showError('この写真は読み込めませんでした。JPEG・PNG・WebPの画像を選んでください。');
      console.error(err);
    }
  });

  $('pf-save').addEventListener('click', async () => {
    const btn = $('pf-save');
    const savedNote = $('pf-saved-note');
    errorEl.style.display = 'none';
    savedNote.style.display = 'none';

    const name = $('pf-name').value.trim();
    const area = $('pf-area').value;
    const gender = $('pf-gender').value;
    const instagram = $('pf-instagram').value.trim().replace(/^@/, '');
    if (!name) return showError('表示名をご入力ください。');
    if (!area) return showError('活動エリアを選んでください。');
    if (!gender) return showError('性別を選んでください。');
    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
      return showError('Instagramはユーザー名のみ（英数字・ピリオド・アンダースコア、30文字まで）で入力してください。');
    }

    const english = $('pf-english').checked;
    const patch = {
      name,
      area,
      gender,
      price_comment: $('pf-comment').value.trim() || null,
      bio: $('pf-bio').value.trim() || null,
      instagram: instagram || null,
      speaks_english: english,
      price_comment_en: english ? ($('pf-comment-en').value.trim() || null) : photographer.price_comment_en,
      bio_en: english ? ($('pf-bio-en').value.trim() || null) : photographer.bio_en,
    };

    btn.disabled = true;
    let uploadedUrl = null;
    try {
      if (pendingBlob) {
        uploadedUrl = await uploadProfilePhoto(userId, pendingBlob);
        patch.photo_url = uploadedUrl;
      }
      const previous = photographer.photo_url;
      photographer = await updateMyPhotographer(photographer.id, patch);
      if (uploadedUrl && previous) removeProfilePhoto(previous);
      pendingBlob = null;
      uploadedUrl = null;
      $('pf-photo').value = '';
      $('pf-photo-note').textContent = '保存すると反映されます';
      savedNote.style.display = 'block';
    } catch (err) {
      if (uploadedUrl) removeProfilePhoto(uploadedUrl);
      showError('保存に失敗しました。時間をおいて再度お試しください。');
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });
}
