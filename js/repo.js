// Supabase data-access layer shared by all pages.
import { supabase } from './supabaseClient.js';
import { getSession } from './auth.js';
import { monitorBookingCounts } from './data.js';

// POST JSON to a Function with the signed-in user's token. A reply that isn't
// JSON (e.g. an empty 404/405 from a host that isn't serving /functions, or an
// HTML error page) is reported with its HTTP status instead of a cryptic
// "Unexpected end of JSON input".
export async function callApi(path, body, fallbackMessage, apiDownMessage) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!data) {
    throw new Error(apiDownMessage || `サーバーが正しく応答しませんでした（HTTP ${res.status}）。サイトのAPI（Cloudflare Pages Functions）が動いていない可能性があります。運営画面の「システム状態」を確認してください。`);
  }
  if (!res.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

// Listed = approved by ops (is_visible) and not paused by the photographer.
// is_paused is filtered here rather than in the query so the page keeps
// working on a database that doesn't have the column yet.
export async function listPhotographers() {
  const { data, error } = await supabase.from('photographers').select('*').eq('is_visible', true).order('id');
  if (error) throw error;
  return data.filter((p) => p.is_paused !== true);
}

export function isBookable(photographer) {
  return photographer.is_visible !== false && photographer.is_paused !== true;
}

export async function getPhotographer(id) {
  const { data, error } = await supabase.from('photographers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// The photographers row linked to the currently signed-in photographer's
// auth account (photographers.profile_id = auth.uid()). Returns null if not
// signed in or no row is linked yet (see supabase/schema.sql demo-account note).
export async function getMyPhotographerRow() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('photographers')
    .select('*')
    .eq('profile_id', session.user.id)
    .single();
  if (error) return null;
  return data;
}

// photographer: saves the profile columns granted in supabase/schema.sql
// (RLS limits the update to the signed-in user's own row).
export async function updateMyPhotographer(photographerId, patch) {
  const { data, error } = await supabase.from('photographers').update(patch).eq('id', photographerId).select().single();
  if (error) throw error;
  return data;
}

const PHOTO_BUCKET = 'photographer-photos';

// Photos live under <auth uid>/ in the public bucket (storage policies only
// allow that folder). The file name is unique per upload, so a replaced photo
// never shows a stale cached copy.
export async function uploadProfilePhoto(userId, blob) {
  const path = `${userId}/profile-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Best effort: cleans up a replaced/abandoned upload. URLs that aren't in the
// bucket (e.g. a file under assets/) are left alone.
export async function removeProfilePhoto(url) {
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  if (i < 0) return;
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([url.slice(i + marker.length)]);
  } catch (err) {
    console.warn('could not remove old profile photo', err);
  }
}

export async function getPlans(photographerId) {
  const { data, error } = await supabase.from('plans').select('*').eq('photographer_id', photographerId).order('sort_order');
  if (error) throw error;
  return data;
}

// Public reviews only: the author and ops can also *read* a hidden review (RLS),
// but it must never show up on the photographer's page.
export async function getReviews(photographerId) {
  const { data, error } = await supabase.from('reviews').select('*').eq('photographer_id', photographerId).eq('is_hidden', false).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ---- post-shoot reviews (customer side) ----

// The signed-in customer's own reviews, keyed by booking id.
export async function getMyReviewsByBooking(bookingIds) {
  if (!bookingIds.length) return {};
  const { data, error } = await supabase.from('reviews').select('*').in('booking_id', bookingIds);
  if (error) throw error;
  const map = {};
  for (const row of data) map[row.booking_id] = row;
  return map;
}

// Creates or edits the review for a booking. The database is what enforces who
// may write (own booking, shoot already over, one per booking — see schema.sql);
// this only sends the editable fields.
export async function saveReview({ existing, booking, reviewerName, stars, comment }) {
  const fields = { reviewer_name: reviewerName, stars, comment: comment || null };
  if (existing) {
    const { data, error } = await supabase.from('reviews').update(fields).eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  }
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { data, error } = await supabase.from('reviews')
    .insert({ ...fields, photographer_id: booking.photographer_id, booking_id: booking.id, client_id: session.user.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteReview(reviewId) {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) throw error;
}

// ---- reviews (ops moderation) ----

// ops: latest reviews including hidden ones (RLS lets ops read all).
export async function getReviewsForModeration(limit = 50) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, photographers(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Goes through a Function (ops-role check + service_role): a browser role can't
// be granted is_hidden without letting reviewers un-hide their own review.
export async function setReviewHidden(reviewId, hidden) {
  return callApi('/api/reviews/moderate', { review_id: reviewId, hidden }, '更新に失敗しました。');
}

// ---- calendar / availability ----

export async function getTakenSlots(photographerId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('booking_slots')
    .select('booking_date, start_time, end_time')
    .eq('photographer_id', photographerId)
    .gte('booking_date', fromDate)
    .lte('booking_date', toDate);
  if (error) throw error;
  return data;
}

// Shifts the photographer has OPENED in the range (a slot is bookable only
// when opened — closed is the default, so there is no row for a closed slot).
export async function getOpenShifts(photographerId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('shifts')
    .select('shift_date, start_time, is_open')
    .eq('photographer_id', photographerId)
    .eq('is_open', true)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate);
  if (error) throw error;
  return data;
}

// rows: [{shift_date, start_time}] to open / close. Closing deletes the row.
export async function openShifts(photographerId, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => ({ photographer_id: photographerId, shift_date: r.shift_date, start_time: r.start_time, is_open: true }));
  const { error } = await supabase.from('shifts').upsert(payload, { onConflict: 'photographer_id,shift_date,start_time' });
  if (error) throw error;
}

export async function closeShifts(photographerId, rows) {
  // one delete per day (PostgREST can't filter on a list of (date, time) pairs)
  const byDay = {};
  rows.forEach((r) => { (byDay[r.shift_date] = byDay[r.shift_date] || []).push(r.start_time); });
  for (const [day, times] of Object.entries(byDay)) {
    const { error } = await supabase.from('shifts').delete().eq('photographer_id', photographerId).eq('shift_date', day).in('start_time', times);
    if (error) throw error;
  }
}

// ---- bookings ----

export async function getBooking(id) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getMyBookings() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    .eq('client_id', session.user.id)
    .order('booking_date', { ascending: true });
  if (error) throw error;
  return data.map((b) => ({ ...b, photographer_name: b.photographers?.name || b.photographer_id }));
}

export async function getPhotographerBookings(photographerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('photographer_id', photographerId)
    .order('booking_date', { ascending: true });
  if (error) throw error;
  return data;
}

// Goes through a Function (not a direct table update) so the cancellation
// emails to the customer and photographer are always sent.
// Photographer (or ops): record delivery with the album link; the customer is emailed.
// The Stripe receipt link for a paid booking (opens Stripe's receipt page).
export async function getReceiptUrl(bookingId) {
  const res = await callApi('/api/bookings/receipt', { booking_id: bookingId }, '領収書を取得できませんでした。');
  return res.url;
}

// The photographer's LINE通知 settings: action 'status' | 'code' | 'unlink'.
export async function lineLink(action) {
  return callApi('/api/line/link', { action }, 'LINE連携の処理に失敗しました。');
}

// The photographer's 「確認しました」 for a confirmed / rescheduled booking.
export async function ackBooking(bookingId) {
  return callApi('/api/bookings/ack', { booking_id: bookingId }, '確認の登録に失敗しました。');
}

export async function deliverBooking(bookingId, deliveryUrl) {
  return callApi('/api/bookings/deliver', { booking_id: bookingId, delivery_url: deliveryUrl }, '納品の登録に失敗しました。');
}

// After sending a chat message: let the server email the other party
// (throttled there). Never throws — the message itself is already sent.
export async function notifyNewMessage(bookingId) {
  try { await callApi('/api/messages/notify', { booking_id: bookingId }, ''); } catch (e) { /* best effort */ }
}

// ---- ops: booking management (予約の管理) ----

// Ops: find bookings of any date by 注文番号, the customer's name, email or
// phone (partial match). Characters that would break the PostgREST filter
// are dropped; full-width letters/digits are folded to half-width.
export async function searchBookingsForOps(query) {
  const q = String(query || '')
    .replace(/[Ａ-Ｚａ-ｚ０-９－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[%,()*\\"]/g, ' ')
    .trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    .or(['order_number', 'customer_name', 'customer_contact'].map((c) => `${c}.ilike.%${q}%`).join(','))
    .order('booking_date', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data.map((b) => ({ ...b, photographer_name: b.photographers?.name || b.photographer_id }));
}

// Ops: every booking with a shoot date in [fromIso, toIso], for 売上管理. PostgREST
// returns at most 1,000 rows per request, so this reads in pages until done.
export async function getBookingsForSales(fromIso, toIso) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, photographers(name)')
      .gte('booking_date', fromIso)
      .lte('booking_date', toIso)
      .order('booking_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map((b) => ({ ...b, photographer_name: b.photographers?.name || b.photographer_id }));
}

// Bookings from fromIso on (past shoots and cancellations included), with the
// photographer's name, for the ops list. Ops can read every booking (RLS).
export async function getBookingsForOps(fromIso) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    .gte('booking_date', fromIso)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data.map((b) => ({ ...b, photographer_name: b.photographers?.name || b.photographer_id }));
}

// Bookings that need ops attention whatever their date: a refund that failed,
// or a payout on hold (chargeback, refund made in Stripe).
export async function getBookingsNeedingAttention() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    .or('refund_status.eq.failed,payout_hold.eq.true')
    .order('booking_date', { ascending: true });
  if (error) throw error;
  return data.map((b) => ({ ...b, photographer_name: b.photographers?.name || b.photographer_id }));
}

export async function opsCancelBooking(bookingId, refundAmount, reason, note) {
  return callApi('/api/bookings/ops-cancel', { booking_id: bookingId, refund_amount: refundAmount, reason, note }, 'キャンセルに失敗しました。');
}

export async function markRefunded(bookingId, note) {
  return callApi('/api/bookings/mark-refunded', { booking_id: bookingId, note }, '更新に失敗しました。');
}

// Ops: send the 異性スタッフ写真セレクト pick to the customer.
export async function sendStaffPick(bookingId, note) {
  return callApi('/api/bookings/staff-pick', { booking_id: bookingId, note }, '送信に失敗しました。');
}

export async function setPayoutHold(bookingId, hold, reason) {
  return callApi('/api/bookings/payout-hold', { booking_id: bookingId, hold, reason }, '更新に失敗しました。');
}

// Moves the signed-in customer's booking to another date/time (rules and
// slot checks are on the server). Resolves to { ok, booking_date, start_time, end_time, used_plan }.
export async function rescheduleBooking(bookingId, bookingDate, startTime) {
  return callApi('/api/bookings/reschedule', { booking_id: bookingId, booking_date: bookingDate, start_time: startTime }, '日程変更に失敗しました。', '時間をおいて再度お試しください。');
}

// Ops only: treat a booking as a same-day cancellation because the customer
// was 15+ minutes late. Resolves to { ok, fee, refund, refund_status, compensation }.
export async function markNoShow(bookingId, note) {
  return callApi('/api/bookings/no-show', { booking_id: bookingId, note }, '遅刻キャンセルの処理に失敗しました。');
}

// Resolves to { ok, fee, refund, refund_status }.
export async function cancelBooking(bookingId) {
  return callApi('/api/bookings/cancel', { booking_id: bookingId }, 'キャンセル処理に失敗しました。', '時間をおいて再度お試しください。');
}

// ---- chat ----

export async function getMessages(bookingId) {
  const { data, error } = await supabase.from('messages').select('*').eq('booking_id', bookingId).order('created_at');
  if (error) throw error;
  return data;
}

export async function sendMessage(bookingId, role, text) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { error } = await supabase.from('messages').insert({
    booking_id: bookingId, sender_role: role, sender_id: session.user.id, text,
  });
  if (error) throw error;
}

export function subscribeToMessages(bookingId, onInsert) {
  const channel = supabase
    .channel('messages-' + bookingId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` }, (payload) => onInsert(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function markRead(bookingId, role) {
  const { error } = await supabase
    .from('message_reads')
    .upsert({ booking_id: bookingId, role, last_read_at: new Date().toISOString() }, { onConflict: 'booking_id,role' });
  if (error) throw error;
}

export async function getReadTimestamps(bookingIds) {
  if (!bookingIds.length) return {};
  const { data, error } = await supabase.from('message_reads').select('*').in('booking_id', bookingIds);
  if (error) throw error;
  const map = {};
  for (const row of data) {
    map[row.booking_id] = map[row.booking_id] || {};
    map[row.booking_id][row.role] = row.last_read_at;
  }
  return map;
}

export async function getMessageCounts(bookingIds) {
  if (!bookingIds.length) return {};
  const { data, error } = await supabase.from('messages').select('booking_id, sender_role, created_at').in('booking_id', bookingIds);
  if (error) throw error;
  const map = {};
  for (const row of data) {
    map[row.booking_id] = map[row.booking_id] || [];
    map[row.booking_id].push(row);
  }
  return map;
}

// ---- guarantee claims (マッチング数保証・再撮影補償) ----

export async function applyGuaranteeClaim(bookingId, eligibleAtIso) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { error } = await supabase.from('guarantee_claims').insert({
    booking_id: bookingId, client_id: session.user.id, eligible_at: eligibleAtIso,
  });
  if (error) throw error;
}

export async function submitGuaranteeClaim(claimId, note) {
  const { error } = await supabase
    .from('guarantee_claims')
    .update({ status: 'claimed', claim_note: note, claim_submitted_at: new Date().toISOString() })
    .eq('id', claimId);
  if (error) throw error;
  notifyOpsOf('guarantee_claim', claimId);
}

// Tells ops by email about a claim / monitor application just submitted.
// Best effort: the submission itself already succeeded.
function notifyOpsOf(kind, id) {
  callApi('/api/notify/ops', { kind, id }, '').catch(() => {});
}

// Customer: book the free reshoot of an approved マッチング数保証 claim.
export async function createReshoot(claimId, bookingDate, startTime) {
  return callApi('/api/guarantee/reshoot', { claim_id: claimId, booking_date: bookingDate, start_time: startTime }, '再撮影の予約に失敗しました。', '時間をおいて再度お試しください。');
}

export async function getGuaranteeClaimsForBookings(bookingIds) {
  if (!bookingIds.length) return {};
  const { data, error } = await supabase.from('guarantee_claims').select('*').in('booking_id', bookingIds);
  if (error) throw error;
  const map = {};
  for (const row of data) map[row.booking_id] = row;
  return map;
}

// ops: review queue across all clients
export async function getGuaranteeClaimsForReview() {
  const { data, error } = await supabase
    .from('guarantee_claims')
    .select('*, bookings(photographer_id, plan_name, booking_date, start_time, customer_name, customer_contact, photographers(name))')
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Ops only. Goes through a Function so the customer (and on approval the
// photographer) are emailed the result.
export async function reviewGuaranteeClaim(claimId, status, reviewNote) {
  return callApi('/api/guarantee/review', { claim_id: claimId, status, note: reviewNote }, '更新に失敗しました。');
}

// ---- bank accounts (カメラマンの報酬振込先) ----

export async function getBankAccount(photographerId) {
  const { data, error } = await supabase
    .from('photographer_bank_accounts')
    .select('*')
    .eq('photographer_id', photographerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBankAccount(photographerId, fields) {
  const { error } = await supabase
    .from('photographer_bank_accounts')
    .upsert({ photographer_id: photographerId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'photographer_id' });
  if (error) throw error;
}

// ops: bank accounts for a batch of photographers, keyed by photographer_id.
export async function getBankAccountsForPhotographers(photographerIds) {
  if (!photographerIds.length) return {};
  const { data, error } = await supabase.from('photographer_bank_accounts').select('*').in('photographer_id', photographerIds);
  if (error) throw error;
  const map = {};
  for (const row of data) map[row.photographer_id] = row;
  return map;
}

// ---- payouts (カメラマンへの報酬送金 — 月末締め・翌月25日payoutの銀行振込) ----

// ops: bookings still awaiting a payout, across all photographers.
export async function getPayoutCandidates() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    // paid bookings, plus canceled ones that owe a same-day compensation
    .or('status.eq.paid,and(status.eq.canceled,photographer_cancel_comp.gt.0)')
    .eq('payout_status', 'pending')
    .order('booking_date', { ascending: true });
  if (error) throw error;
  return data;
}

// Marking a payout released is a plain DB write (no Stripe Connect involved
// — the actual transfer happens as a manual bank transfer by ops), but it
// still goes through a Function so ops-role authorization is enforced
// server-side rather than relying on RLS alone for money-adjacent state.
export async function releasePayout(bookingId, note) {
  return callApi('/api/payouts/release', { booking_id: bookingId, note }, '更新に失敗しました。');
}

// Ops: 「まとめて振込済みにする」 — records several payouts and emails each
// photographer one summary. Resolves to { results: [{ booking_id, ok, error }], released }.
export async function releasePayouts(bookingIds, note) {
  return callApi('/api/payouts/release-batch', { booking_ids: bookingIds, note }, '更新に失敗しました。');
}

// ops: every photographer (listed or not) with how many plans each has, for
// the 掲載管理 screen. Both tables are publicly readable.
export async function getPhotographersForReview() {
  const [{ data: photographers, error: e1 }, { data: plans, error: e2 }] = await Promise.all([
    supabase.from('photographers').select('*').order('created_at', { ascending: false }),
    supabase.from('plans').select('photographer_id'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const planCounts = {};
  for (const p of plans) planCounts[p.photographer_id] = (planCounts[p.photographer_id] || 0) + 1;
  return photographers.map((p) => ({ ...p, planCount: planCounts[p.id] || 0 }));
}

// ops: approve (visible = true) or take down a listing. Goes through a
// Function: a browser role can't be given is_visible without also letting
// photographers flip it on their own row.
// verified: ops confirms the photographer has completed ID verification and
// service training (required the first time a photographer is published).
// Ops: the 撮影実績 badge (「実績250+」). null hides it.
export async function setPhotographerShootCount(photographerId, shootCount) {
  return callApi('/api/photographers/shoot-count', { photographer_id: photographerId, shoot_count: shootCount }, '保存に失敗しました。');
}

export async function setPhotographerVisibility(photographerId, visible, verified = false) {
  return callApi('/api/photographers/visibility', { photographer_id: photographerId, visible, verified }, '更新に失敗しました。');
}

// ops: creates a login account for a new photographer (goes through a
// Function since it needs the service_role key to call Supabase's Admin
// Auth API — not something the browser's anon key can do).
export async function createPhotographerAccount(name, email) {
  return callApi('/api/photographers/create', { name, email }, 'アカウント作成に失敗しました。');
}

// Ops only: issues a fresh temp password for an existing photographer account.
export async function resetPhotographerPassword(email) {
  return callApi('/api/photographers/reset-password', { email }, 'パスワードの再発行に失敗しました。');
}

// ---- monitor applications (モニター価格プログラム) ----

export async function submitMonitorApplication({ hasExistingPhotos, currentApps, motivation, followUpOptIn }) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { data, error } = await supabase.from('monitor_applications').insert({
    client_id: session.user.id,
    has_existing_photos: hasExistingPhotos,
    current_apps: currentApps,
    motivation,
    follow_up_opt_in: followUpOptIn,
  }).select('id').single();
  if (error) throw error;
  if (data && data.id) notifyOpsOf('monitor_application', data.id);
}

// Remaining monitor places (先着の定員 − 当選者). null if it can't be read.
export async function getMonitorSlotsLeft() {
  const { data, error } = await supabase.rpc('monitor_slots_left');
  if (error) return null;
  return typeof data === 'number' ? data : null;
}

export async function getMyMonitorApplications() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('monitor_applications')
    .select('*')
    .eq('client_id', session.user.id)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ops: review queue across all clients
export async function getMonitorApplicationsForReview() {
  const { data, error } = await supabase
    .from('monitor_applications')
    .select('*, profiles(name, email)')
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Ops only. Goes through a Function so the result email to the applicant
// is always sent. Resolves to { ok, emailed }.
export async function reviewMonitorApplication(applicationId, status, reviewNote) {
  return callApi('/api/monitor/review', { application_id: applicationId, status, note: reviewNote }, '更新に失敗しました。');
}

// Whether the signed-in customer still has an unused monitor price (accepted
// application with no booking that used it). Display only — the checkout
// Function makes the same decision itself when it sets the price.
export async function hasUnusedMonitorPrice() {
  const session = await getSession();
  if (!session) return false;
  const { data: apps, error } = await supabase
    .from('monitor_applications')
    .select('id')
    .eq('client_id', session.user.id)
    .eq('status', 'accepted')
    .order('applied_at', { ascending: true })
    .limit(1);
  if (error || !apps || !apps.length) return false;
  const { data: used, error: usedError } = await supabase
    .from('bookings')
    .select('status, created_at')
    .eq('monitor_application_id', apps[0].id);
  if (usedError) return false;
  return !used.some((b) => monitorBookingCounts(b));
}

// ---- counseling sheet ----

export async function getCounselingSheet(bookingId) {
  const { data, error } = await supabase.from('counseling_sheets').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCounselingSheetsForBookings(bookingIds) {
  if (!bookingIds.length) return {};
  const { data, error } = await supabase.from('counseling_sheets').select('*').in('booking_id', bookingIds);
  if (error) throw error;
  const map = {};
  for (const row of data) map[row.booking_id] = row;
  return map;
}

export async function saveCounselingSheet(bookingId, answers) {
  const { error } = await supabase
    .from('counseling_sheets')
    .upsert({ booking_id: bookingId, answers, submitted_at: new Date().toISOString() }, { onConflict: 'booking_id' });
  if (error) throw error;
}
