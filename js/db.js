// Data layer shared by the public site and the admin page.
// Uses Firebase (Auth + Firestore) when configured, otherwise a localStorage demo.
import { firebaseConfig, STAFF_EMAILS } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.5';
export const DEMO = !firebaseConfig.apiKey;
const DEMO_PASSWORD = 'admin123';

const toDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : v ? new Date(v) : new Date());

let fb; // lazily loaded Firebase modules + instances
async function firebase() {
  if (fb) return fb;
  const [app, fs, auth] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-firestore.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  const instance = app.initializeApp(firebaseConfig);
  fb = { fs, auth, db: fs.getFirestore(instance), au: auth.getAuth(instance) };
  return fb;
}

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

/* ---------- Generic collection helpers ---------- */
async function add(col, data) {
  if (DEMO) { write(col, [...read(col), { id: newId(), ...data, createdAt: Date.now() }]); return; }
  const { fs, db } = await firebase();
  await fs.addDoc(fs.collection(db, col), { ...data, createdAt: fs.serverTimestamp() });
}

async function update(col, id, data) {
  if (DEMO) { write(col, read(col).map((d) => (d.id === id ? { ...d, ...data } : d))); return; }
  const { fs, db } = await firebase();
  await fs.updateDoc(fs.doc(db, col, id), data);
}

async function remove(col, id) {
  if (DEMO) { write(col, read(col).filter((d) => d.id !== id)); return; }
  const { fs, db } = await firebase();
  await fs.deleteDoc(fs.doc(db, col, id));
}

// Calls cb(list) now and whenever the collection changes. Returns an unsubscribe function.
function watch(col, cb, onError = console.error) {
  if (DEMO) return demoWatch(col, cb);
  let unsub = () => {};
  let stopped = false;
  firebase().then(({ fs, db }) => {
    if (stopped) return;
    const q = fs.query(fs.collection(db, col), fs.orderBy('createdAt', 'desc'));
    unsub = fs.onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) })));
    }, onError);
  }).catch(onError);
  return () => { stopped = true; unsub(); };
}

/* ---------- Orders ---------- */
export const addOrder = (order) => add('orders', { ...order, status: 'new' });
export const updateOrderStatus = (id, status) => update('orders', id, { status });
export const deleteOrder = (id) => remove('orders', id);
export const watchOrders = (cb, onError) => watch('orders', cb, onError);

/* ---------- Projects ---------- */
export const addProject = (project) => add('projects', project);
export const deleteProject = (id) => remove('projects', id);
export const watchProjects = (cb, onError) => watch('projects', cb, onError);

/* ---------- Auth ---------- */
// Only emails listed in STAFF_EMAILS (js/firebase-config.js) may use the staff area,
// whichever way they sign in. firestore.rules enforces the same list on the database.
const isStaff = (email) => STAFF_EMAILS.map((e) => e.toLowerCase()).includes((email || '').toLowerCase());
const NOT_STAFF = (email) => new Error(`${email || 'This account'} is not on the staff list. Ask an admin to add it.`);
let authError = null; // why the last sign-in was rejected

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
  const { auth, au } = await firebase();
  let cred;
  try {
    cred = await auth.signInWithEmailAndPassword(au, email, password);
  } catch {
    throw new Error('Incorrect email or password.');
  }
  if (!cred.user.emailVerified) {
    await auth.sendEmailVerification(cred.user);
    await auth.signOut(au);
    throw new Error(`First time? We sent a verification link to ${email}. Click it, then log in again.`);
  }
}

// provider: 'google' | 'apple'
export async function loginWith(provider) {
  if (DEMO) {
    const name = provider === 'apple' ? 'Apple' : 'Google';
    const email = window.prompt(`Demo mode: type the ${name} account email to simulate signing in.`);
    if (email) demoSignIn(email.trim());
    return;
  }
  const { auth, au } = await firebase();
  let p;
  if (provider === 'apple') {
    p = new auth.OAuthProvider('apple.com');
    p.addScope('email');
    p.addScope('name');
  } else {
    p = new auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
  }
  authError = null;
  try {
    await auth.signInWithPopup(au, p);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-environment') {
      await auth.signInWithRedirect(au, p); // some phone browsers block popups
      return;
    }
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/account-exists-with-different-credential') {
      throw new Error('This email already signs in another way. Please use that method.');
    }
    throw new Error('Sign-in failed. Please try again.');
  }
  if (authError) throw authError;
}

export async function logout() {
  if (DEMO) { sessionStorage.removeItem('glodire-admin'); window.dispatchEvent(new Event('glodire-auth')); return; }
  const { auth, au } = await firebase();
  await auth.signOut(au);
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
  firebase().then(({ auth, au }) => {
    auth.getRedirectResult(au).catch(() => {});
    auth.onAuthStateChanged(au, (u) => {
      if (u && !isStaff(u.email)) {
        authError = NOT_STAFF(u.email);
        onDenied(authError);
        auth.signOut(au);
        return;
      }
      if (u && !u.emailVerified) { auth.signOut(au); return; }
      cb(u ? { email: u.email } : null);
    });
  });
}
