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

/* ---------- Auth ---------- */
// Only emails listed in STAFF_EMAILS (js/supabase-config.js) may use the staff area,
// whichever way they sign in. supabase/schema.sql enforces the same list on the database.
const isStaff = (email) => STAFF_EMAILS.map((e) => e.toLowerCase()).includes((email || '').toLowerCase());
const NOT_STAFF = (email) => new Error(`${email || 'This account'} is not on the staff list. Ask an admin to add it.`);

function demoSignIn(email) {
  if (!isStaff(email)) throw NOT_STAFF(email);
  sessionStorage.setItem('glodire-admin', email);
  window.dispatchEvent(new Event('glodire-auth'));
}

export async function login(email, password) {
  if (DEMO) {
    if (password !== DEMO_PASSWORD) throw new Error('Wrong password. In demo mode the password is "admin123".');
    demoSignIn(email);
    return;
  }
  if (!isStaff(email)) throw NOT_STAFF(email);
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) {
      throw new Error(`Please confirm your email first: open the link Supabase sent to ${email}, then log in again.`);
    }
    throw new Error('Incorrect email or password.');
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
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
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
// onDenied(error) is called when someone who is not on the staff list signs in.
export function onAuth(cb, onDenied = () => {}) {
  if (DEMO) {
    const emit = () => { const e = sessionStorage.getItem('glodire-admin'); cb(e ? { email: e } : null); };
    window.addEventListener('glodire-auth', emit);
    emit();
    return;
  }
  supabase().then((sb) => {
    let last; // avoid re-rendering on token refreshes
    sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u && !isStaff(u.email)) {
        onDenied(NOT_STAFF(u.email));
        setTimeout(() => sb.auth.signOut(), 0); // don't call Supabase inside this callback
        return;
      }
      if (u && !u.email_confirmed_at) { setTimeout(() => sb.auth.signOut(), 0); return; }
      const email = u ? u.email : null;
      if (email === last) return;
      last = email;
      cb(u ? { email } : null);
    });
  }).catch((err) => { console.error(err); cb(null); });
}
