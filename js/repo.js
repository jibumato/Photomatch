// Supabase data-access layer shared by all pages.
import { supabase } from './supabaseClient.js';
import { getSession } from './auth.js';

export async function listPhotographers() {
  const { data, error } = await supabase.from('photographers').select('*').eq('is_visible', true).order('id');
  if (error) throw error;
  return data;
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

export async function getPlans(photographerId) {
  const { data, error } = await supabase.from('plans').select('*').eq('photographer_id', photographerId).order('sort_order');
  if (error) throw error;
  return data;
}

export async function getReviews(photographerId) {
  const { data, error } = await supabase.from('reviews').select('*').eq('photographer_id', photographerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
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

export async function getClosedShifts(photographerId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('shifts')
    .select('shift_date, start_time, is_open')
    .eq('photographer_id', photographerId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate);
  if (error) throw error;
  return data;
}

export async function toggleShift(photographerId, dateIso, startTime, closeIt) {
  if (closeIt) {
    const { error } = await supabase
      .from('shifts')
      .upsert({ photographer_id: photographerId, shift_date: dateIso, start_time: startTime, is_open: false },
        { onConflict: 'photographer_id,shift_date,start_time' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('photographer_id', photographerId)
      .eq('shift_date', dateIso)
      .eq('start_time', startTime);
    if (error) throw error;
  }
}

export async function bulkSetShiftsOpen(photographerId, dateIsos) {
  const { error } = await supabase.from('shifts').delete().eq('photographer_id', photographerId).in('shift_date', dateIsos);
  if (error) throw error;
}

export async function bulkSetShiftsClosed(photographerId, rows) {
  // rows: [{shift_date, start_time}]
  const payload = rows.map((r) => ({ photographer_id: photographerId, shift_date: r.shift_date, start_time: r.start_time, is_open: false }));
  const { error } = await supabase.from('shifts').upsert(payload, { onConflict: 'photographer_id,shift_date,start_time' });
  if (error) throw error;
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
export async function cancelBooking(bookingId) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const res = await fetch('/api/bookings/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'キャンセル処理に失敗しました。');
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

export async function reviewGuaranteeClaim(claimId, status, reviewNote) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { error } = await supabase
    .from('guarantee_claims')
    .update({ status, review_note: reviewNote, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id })
    .eq('id', claimId);
  if (error) throw error;
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

// ops: paid bookings still awaiting a payout, across all photographers.
export async function getPayoutCandidates() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, photographers(name)')
    .eq('status', 'paid')
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
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const res = await fetch('/api/payouts/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ booking_id: bookingId, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新に失敗しました。');
  return data;
}

// ---- monitor applications (モニター価格プログラム) ----

export async function submitMonitorApplication({ hasExistingPhotos, currentApps, motivation, followUpOptIn }) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { error } = await supabase.from('monitor_applications').insert({
    client_id: session.user.id,
    has_existing_photos: hasExistingPhotos,
    current_apps: currentApps,
    motivation,
    follow_up_opt_in: followUpOptIn,
  });
  if (error) throw error;
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

export async function reviewMonitorApplication(applicationId, status, reviewNote) {
  const session = await getSession();
  if (!session) throw new Error('not signed in');
  const { error } = await supabase
    .from('monitor_applications')
    .update({ status, review_note: reviewNote, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id })
    .eq('id', applicationId);
  if (error) throw error;
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
