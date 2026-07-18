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

export async function signUp({ email, password, name, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  });
  if (error) throw error;
  return data;
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
