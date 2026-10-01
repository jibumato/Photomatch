// Helpers for rendering text that people can edit themselves (photographer
// profiles, etc.) into innerHTML / inline styles.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// photographers.photo_url ends up inside `background-image:url(...)` in an
// inline style, so only accept the two shapes the app itself produces (a file
// under assets/, or an object in our public photo bucket). Both consist solely
// of characters that can't break out of the style attribute or the url().
// supabase/schema.sql enforces the same shape on the column.
const PHOTO_URL_RE = /^(assets\/[A-Za-z0-9._-]+|https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photographer-photos\/[A-Za-z0-9._/-]+)$/;

export function safePhotoUrl(url) {
  return typeof url === 'string' && PHOTO_URL_RE.test(url) ? url : '';
}
