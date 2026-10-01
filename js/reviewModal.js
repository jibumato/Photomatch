// 撮影後レビューの投稿・編集・削除モーダル（マイページ）。
// 投稿できる条件（自分の予約・撮影終了後・1予約1件）は DB が強制する。
import { saveReview, deleteReview } from './repo.js';
import { escapeHtml } from './util.js';

const DEFAULT_NAME = '匿名のお客様';
const STAR_LABELS = ['', '不満', 'やや不満', 'ふつう', '満足', 'とても満足'];

export function mountReviewModal(container) {
  container.innerHTML = `
  <div class="pm-modal-overlay" id="review-overlay">
    <div class="pm-modal-backdrop" id="review-backdrop"></div>
    <div class="pm-modal-sheet pm-sheet-modal" style="height:auto;max-height:92vh" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div class="pm-modal-head">
        <div style="min-width:0">
          <div id="review-title" style="font:700 16px var(--pm-font-body);color:oklch(0.24 0.02 245)">撮影のレビュー</div>
          <div id="review-booking-label" style="font:11px var(--pm-font-body);color:var(--pm-text-3)"></div>
        </div>
        <button class="pm-modal-close" id="review-close" aria-label="閉じる">×</button>
      </div>
      <div class="pm-sheet-body">
        <div class="pm-field" style="margin-bottom:18px">
          <label id="review-stars-label">総合評価</label>
          <div id="review-stars" role="radiogroup" aria-labelledby="review-stars-label" style="display:flex;align-items:center;gap:4px"></div>
          <div id="review-stars-text" style="font:12px var(--pm-font-body);color:var(--pm-text-3);min-height:18px;margin-top:2px"></div>
        </div>
        <div class="pm-field" style="margin-bottom:18px">
          <label for="review-comment">コメント（任意）</label>
          <textarea class="pm-textarea" id="review-comment" rows="5" maxlength="1000" placeholder="撮影の雰囲気、写真の仕上がり、当日の進め方など、感じたことをお書きください"></textarea>
        </div>
        <div class="pm-field" style="margin-bottom:16px">
          <label for="review-name">表示名（任意）</label>
          <input class="pm-input" type="text" id="review-name" maxlength="20" placeholder="${DEFAULT_NAME}">
          <div style="font:11px/1.7 var(--pm-font-body);color:var(--pm-text-3);margin-top:4px">本名でなくてかまいません。未入力の場合は「${DEFAULT_NAME}」と表示します。</div>
        </div>
        <p style="font:12px/1.8 var(--pm-font-body);color:var(--pm-text-3);margin:0 0 4px;padding:12px 14px;background:oklch(0.97 0.015 210);border-radius:12px">投稿したレビューは、カメラマンのプロフィールページに公開されます。個人が特定できる情報や、誹謗中傷にあたる内容はご遠慮ください。運営が不適切と判断した場合は、非表示にすることがあります。</p>
        <div class="pm-error-text" id="review-error" style="display:none;margin-top:10px"></div>
      </div>
      <div class="pm-sheet-foot">
        <button class="pm-btn" id="review-delete" style="display:none;background:#fff;border:1px solid var(--pm-border);border-radius:100px;padding:13px 18px;font:600 14px var(--pm-font-body);color:oklch(0.5 0.15 25)">削除</button>
        <button class="pm-btn" id="review-save" style="flex:1;background:var(--pm-brand-grad-soft);border:none;border-radius:100px;padding:13px;font:700 14px var(--pm-font-body);color:#fff">投稿する</button>
      </div>
    </div>
  </div>`;

  const $ = (id) => container.querySelector('#' + id);
  const overlay = $('review-overlay');
  const starsEl = $('review-stars');
  let current = null; // { booking, existing, onSaved }
  let stars = 0;

  function renderStars() {
    starsEl.innerHTML = [1, 2, 3, 4, 5].map((n) => `
      <button type="button" role="radio" aria-checked="${n === stars}" aria-label="${n}つ星 ${STAR_LABELS[n]}" data-star="${n}"
        style="background:none;border:none;padding:2px;cursor:pointer;font:32px/1 var(--pm-font-body);color:${n <= stars ? 'var(--pm-star)' : 'oklch(0.88 0.01 220)'}">★</button>`).join('');
    $('review-stars-text').textContent = stars ? STAR_LABELS[stars] : '星をタップして評価してください';
    starsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { stars = Number(b.dataset.star); renderStars(); }));
  }

  function close() { overlay.classList.remove('is-open'); }
  function showError(msg) { const e = $('review-error'); e.textContent = msg; e.style.display = 'block'; }

  $('review-close').addEventListener('click', close);
  $('review-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });

  $('review-save').addEventListener('click', async () => {
    $('review-error').style.display = 'none';
    if (!stars) return showError('星をタップして評価してください。');
    const btn = $('review-save');
    btn.disabled = true;
    try {
      await saveReview({
        existing: current.existing,
        booking: current.booking,
        reviewerName: $('review-name').value.trim() || DEFAULT_NAME,
        stars,
        comment: $('review-comment').value.trim(),
      });
      close();
      if (current.onSaved) current.onSaved();
    } catch (err) {
      console.error(err);
      showError(/duplicate|unique/i.test(err.message || '')
        ? 'この撮影のレビューは、すでに投稿されています。'
        : '投稿できませんでした。撮影の終了後に、ご自身のご予約についてのみ投稿できます。時間をおいて再度お試しください。');
    } finally {
      btn.disabled = false;
    }
  });

  $('review-delete').addEventListener('click', async () => {
    if (!current.existing || !confirm('このレビューを削除します。よろしいですか？')) return;
    const btn = $('review-delete');
    btn.disabled = true;
    try {
      await deleteReview(current.existing.id);
      close();
      if (current.onSaved) current.onSaved();
    } catch (err) {
      console.error(err);
      showError('削除できませんでした。時間をおいて再度お試しください。');
    } finally {
      btn.disabled = false;
    }
  });

  return {
    // booking: the bookings row (with photographer_name); existing: the review row or null.
    open(booking, existing, onSaved) {
      current = { booking, existing, onSaved };
      stars = existing ? existing.stars : 0;
      $('review-booking-label').innerHTML = `${escapeHtml(booking.booking_date)} ・ ${escapeHtml(booking.photographer_name)}さん`;
      $('review-comment').value = existing ? (existing.comment || '') : '';
      $('review-name').value = existing && existing.reviewer_name !== DEFAULT_NAME ? existing.reviewer_name : '';
      $('review-save').textContent = existing ? '更新する' : '投稿する';
      $('review-delete').style.display = existing ? 'block' : 'none';
      $('review-error').style.display = 'none';
      renderStars();
      overlay.classList.add('is-open');
    },
  };
}
