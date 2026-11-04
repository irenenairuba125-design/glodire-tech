// Data layer shared by the public site and the admin page.
// Uses Supabase (Auth + Postgres database) when configured, otherwise a localStorage demo.
import { SUPABASE_URL, SUPABASE_ANON_KEY, STAFF_EMAILS } from './supabase-config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
export const DEMO = !SUPABASE_URL;
const DEMO_PASSWORD = 'admin123';

const toDate = (v) => (v ? new Date(v) : new Date());

let sbPromise; // lazily loaded Supabase client
function supabase() {
  if (!sbPromise) {
    sbPromise = import(SDK).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return sbPromise;
}

// Supabase returns { data, error }; turn errors into exceptions.
const check = ({ data, error }) => { if (error) throw error; return data; };

// Database rows use created_at; the pages use createdAt.
const fromRow = ({ created_at: createdAt, ...rest }) => ({ ...rest, createdAt: toDate(createdAt) });

/* ---------- Demo (localStorage) helpers ---------- */
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const write = (key, list) => {
  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new Event('glodire-db'));
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const demoWatch = (key, cb) => {
  const emit = () => cb(read(key).map((d) => ({ ...d, createdAt: toDate(d.createdAt) }))
    .sort((a, b) => b.createdAt - a.createdAt));
  const onStorage = (e) => { if (!e.key || e.key === key) emit(); };
  window.addEventListener('glodire-db', emit);
  window.addEventListener('storage', onStorage);
  emit();
  return () => { window.removeEventListener('glodire-db', emit); window.removeEventListener('storage', onStorage); };
};

/* ---------- Generic table helpers ---------- */
async function add(table, data) {
  if (DEMO) { write(table, [...read(table), { id: newId(), status: table === 'orders' ? 'new' : undefined, ...data, createdAt: Date.now() }]); return; }
  const sb = await supabase();
  check(await sb.from(table).insert(data)); // status and created_at are set by the database
}

async function update(table, id, data) {
  if (DEMO) { write(table, read(table).map((d) => (d.id === id ? { ...d, ...data } : d))); return; }
  const sb = await supabase();
  check(await sb.from(table).update(data).eq('id', id));
}

async function remove(table, id) {
  if (DEMO) { write(table, read(table).filter((d) => d.id !== id)); return; }
  const sb = await supabase();
  check(await sb.from(table).delete().eq('id', id));
}

// Calls cb(list) now and whenever the table changes. Returns an unsubscribe function.
let channelCount = 0;
function watch(table, cb, onError = console.error) {
  if (DEMO) return demoWatch(table, cb);
  let stopped = false;
  let channel;
  const load = async () => {
    try {
      const sb = await supabase();
      const rows = check(await sb.from(table).select('*').order('created_at', { ascending: false }));
      if (!stopped) cb(rows.map(fromRow));
    } catch (err) {
      if (!stopped) onError(err);
    }
  };
  supabase().then((sb) => {
    if (stopped) return;
    channel = sb.channel(`${table}-${++channelCount}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, load)
      .subscribe();
    load();
  }).catch(onError);
  return () => {
    stopped = true;
    if (channel) supabase().then((sb) => sb.removeChannel(channel));
  };
}

/* ---------- Orders ---------- */
export const addOrder = (order) => add('orders', order);
export const updateOrderStatus = (id, status) => update('orders', id, { status });
export const deleteOrder = (id) => remove('orders', id);
export const watchOrders = (cb, onError) => watch('orders', cb, onError);

/* ---------- Projects ---------- */
export const addProject = (project) => add('projects', project);
export const deleteProject = (id) => remove('projects', id);
export const watchProjects = (cb, onError) => watch('projects', cb, onError);

/* ---------- Admins ---------- */
// The admins table (managed on the Admins tab) decides who may use the staff area.
const normEmail = (e) => (e || '').trim().toLowerCase();
const demoAdmins = () => {
  if (!localStorage.getItem('admins')) {
    write('admins', STAFF_EMAILS.map((email) => ({ email: normEmail(email), createdAt: Date.now() })));
  }
  return read('admins');
};

export function watchAdmins(cb, onError) {
  if (DEMO) { demoAdmins(); return demoWatch('admins', cb); }
  return watch('admins', cb, onError);
}

export async function addAdmin(email) {
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Please enter a valid email address.');
  if (DEMO) {
    if (demoAdmins().some((a) => a.email === e)) throw new Error(`${e} is already an admin.`);
    write('admins', [...demoAdmins(), { email: e, createdAt: Date.now() }]);
    return;
  }
  const sb = await supabase();
  const { error } = await sb.from('admins').insert({ email: e });
  if (error?.code === '23505') throw new Error(`${e} is already an admin.`);
  if (error) throw error;
}

export async function removeAdmin(email) {
  const e = normEmail(email);
  if (DEMO) { write('admins', demoAdmins().filter((a) => a.email !== e)); return; }
  const sb = await supabase();
  check(await sb.from('admins').delete().eq('email', e));
}

/* ---------- Auth ---------- */
const NOT_STAFF = (email) => new Error(`${email || 'This account'} is not an admin. Ask an existing admin to add it on the Admins tab.`);

async function checkStaff(sb) {
  const { data, error } = await sb.rpc('is_staff');
  if (error) throw error;
  return data === true;
}

function demoSignIn(email) {
  if (!demoAdmins().some((a) => a.email === normEmail(email))) throw NOT_STAFF(email);
  sessionStorage.setItem('glodire-admin', normEmail(email));
  window.dispatchEvent(new Event('glodire-auth'));
}

const adminPageUrl = () => window.location.href.split('#')[0].split('?')[0];

// First-time setup for a new admin: creates their password. Supabase emails a
// confirmation link; after clicking it they can log in normally.
export async function signUp(email, password) {
  if (DEMO) throw new Error('Demo mode: just log in with the password "admin123".');
  if (password.length < 8) throw new Error('Please choose a password with at least 8 characters.');
  const sb = await supabase();
  const { data, error } = await sb.auth.signUp({ email: normEmail(email), password, options: { emailRedirectTo: adminPageUrl() } });
  if (error) throw new Error(error.message);
  // Supabase hides whether the email already had an account; identities is empty in that case.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error('This email already has a password. Log in instead, or use "Forgot password?".');
  }
}

export async function resetPassword(email) {
  if (DEMO) throw new Error('Demo mode: the password is "admin123".');
  const sb = await supabase();
  const { error } = await sb.auth.resetPasswordForEmail(normEmail(email), { redirectTo: adminPageUrl() });
  if (error) throw new Error(error.message);
}

export async function setNewPassword(password) {
  if (password.length < 8) throw new Error('Please choose a password with at least 8 characters.');
  const sb = await supabase();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function login(email, password) {
  if (DEMO) {
    if (password !== DEMO_PASSWORD) throw new Error('Wrong password. In demo mode the password is "admin123".');
    demoSignIn(email);
    return;
  }
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) {
      throw new Error(`Please confirm your email first: open the link Supabase sent to ${email}, then log in again.`);
    }
    throw new Error('Incorrect email or password. First time here? Click "New admin? Create your password" below. Forgot it? Click "Forgot password?".');
  }
}

// Which "Continue with ..." sign-in methods are switched on in Supabase
// (Authentication -> Providers). Demo mode shows them all.
export async function enabledProviders() {
  if (DEMO) return ['google', 'apple'];
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) return [];
    const { external = {} } = await res.json();
    return Object.keys(external).filter((p) => external[p] === true);
  } catch {
    return []; // offline or blocked: email login still works
  }
}

// provider: 'google' | 'apple'. Leaves the page, then comes back here signed in.
export async function loginWith(provider) {
  if (DEMO) {
    const name = provider === 'apple' ? 'Apple' : 'Google';
    const email = window.prompt(`Demo mode: type the ${name} account email to simulate signing in.`);
    if (email) demoSignIn(email.trim());
    return;
  }
  const sb = await supabase();
  const redirectTo = adminPageUrl();
  const options = provider === 'google'
    ? { redirectTo, queryParams: { prompt: 'select_account' } }
    : { redirectTo };
  const { error } = await sb.auth.signInWithOAuth({ provider, options });
  if (error) throw new Error('Sign-in failed. Please try again.');
}

export async function logout() {
  if (DEMO) { sessionStorage.removeItem('glodire-admin'); window.dispatchEvent(new Event('glodire-auth')); return; }
  const sb = await supabase();
  await sb.auth.signOut();
}

// Calls cb(user | null) with { email } whenever the login state changes.
// onDenied(error) is called when someone who is not an admin signs in.
// onRecovery() is called when someone arrives from a "reset password" email.
export function onAuth(cb, onDenied = () => {}, onRecovery = () => {}) {
  if (DEMO) {
    const emit = () => { const e = sessionStorage.getItem('glodire-admin'); cb(e ? { email: e } : null); };
    window.addEventListener('glodire-auth', emit);
    emit();
    return;
  }
  supabase().then((sb) => {
    let last; // avoid re-rendering on token refreshes
    sb.auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      // Show the new-password form, but still check the user below so the dashboard
      // can open once the new password is saved.
      if (event === 'PASSWORD_RECOVERY') setTimeout(onRecovery, 0);
      // Don't call Supabase directly inside this callback; defer it.
      setTimeout(async () => {
        const email = u ? normEmail(u.email) : null;
        if (u) {
          let ok = false;
          try { ok = !!u.email_confirmed_at && await checkStaff(sb); } catch (err) { console.error(err); }
          if (!ok) {
            onDenied(NOT_STAFF(u.email));
            last = undefined; // so the sign-out below shows the login form
            await sb.auth.signOut();
            return;
          }
        }
        if (email === last) return;
        last = email;
        cb(u ? { email } : null);
      }, 0);
    });
  }).catch((err) => { console.error(err); cb(null); });
}
