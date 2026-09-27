import { supabase } from './supabaseClient.js';

// profiles.role is either 'client' or 'photographer'.
// A DB trigger (see supabase/schema.sql: handle_new_user) creates the
// profiles row automatically from auth.users metadata on sign-up.

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error) return null;
  return data;
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function signUp({ email, password, name, role, redirectTo }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  if (error) throw error;
  return data;
}

// One form for both new and returning customers: try logging in first, and
// only if the credentials don't match an account, register one.
// Resolves to { status: 'signed_in' } | { status: 'confirm_email' }
// (Supabase "Confirm email" is on, so the session starts after the link in the
// confirmation email is opened) | { status: 'wrong_password' } |
// { status: 'email_not_confirmed' }. Other failures throw.
export async function signInOrSignUp({ email, password, name, redirectTo }) {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInError && signInData.session) return { status: 'signed_in' };
  if (signInError && /not confirmed/i.test(signInError.message || '')) return { status: 'email_not_confirmed' };
  if (signInError && !/invalid login credentials/i.test(signInError.message || '')) throw signInError;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'client' }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message || '')) return { status: 'wrong_password' };
    throw error;
  }
  if (data.session) return { status: 'signed_in' };
  // With email confirmation on, Supabase answers a sign-up for an existing
  // address with a user that has no identities (to avoid revealing which
  // addresses are registered) — since login just failed, the password is wrong.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { status: 'wrong_password' };
  }
  return { status: 'confirm_email' };
}

export async function resendSignupEmail(email, redirectTo) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
  });
  if (error) throw error;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Redirect helpers used at the top of role-gated pages.
export async function requireRole(role, redirectTo) {
  const profile = await getProfile();
  if (!profile || profile.role !== role) {
    window.location.href = redirectTo;
    return null;
  }
  return profile;
}
