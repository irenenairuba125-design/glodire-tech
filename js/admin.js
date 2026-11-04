import {
  DEMO, login, loginWith, logout, onAuth,
  watchOrders, updateOrderStatus, deleteOrder,
  watchProjects, addProject, deleteProject,
} from './db.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

$('demo-banner').hidden = !DEMO;

/* ---------- Auth ---------- */
let stopWatchers = [];

function handleAuth(user) {
  stopWatchers.forEach((stop) => stop());
  stopWatchers = [];
  $('login-view').hidden = !!user;
  $('dash-view').hidden = !user;
  $('admin-user').hidden = !user;
  if (!user) return;
  $('admin-email').textContent = user.email;
  stopWatchers = [watchOrders(renderOrders, showError), watchProjects(renderProjects, showError)];
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = $('login-note');
  note.textContent = 'Signing in…';
  note.className = 'form-note';
  try {
    await login($('email').value.trim(), $('password').value);
    $('login-form').reset();
    note.textContent = '';
  } catch (err) {
    note.textContent = err.message;
    note.className = 'form-note error';
  }
});

document.querySelectorAll('[data-provider]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const note = $('login-note');
    note.textContent = '';
    note.className = 'form-note';
    try {
      await loginWith(btn.dataset.provider);
    } catch (err) {
      note.textContent = err.message;
      note.className = 'form-note error';
    }
  });
});

function showDenied(err) {
  $('login-note').textContent = err.message;
  $('login-note').className = 'form-note error';
}

$('logout').addEventListener('click', () => logout());

function showError(err) {
  console.error(err);
  alert('Could not load data. Check your internet connection and Firebase setup.\n\n' + (err.message || err));
}

/* ---------- Tabs ---------- */
const tabs = [$('tab-orders'), $('tab-projects')];
tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    $(t.getAttribute('aria-controls')).hidden = !on;
  });
}));

/* ---------- Orders ---------- */
const STATUSES = { new: 'New', 'in-progress': 'In progress', done: 'Done' };
let orders = [];
let filter = 'all';

$('filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  filter = chip.dataset.filter;
  document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
  drawOrders();
});

function renderOrders(list) {
  orders = list;
  const n = list.filter((o) => o.status === 'new').length;
  $('new-count').textContent = n;
  $('new-count').hidden = n === 0;
  drawOrders();
}

const fmtDate = (d) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function contactLinks(contact) {
  const wrap = el('div', 'order-contact');
  if (contact.includes('@')) {
    const a = el('a', null, contact);
    a.href = `mailto:${contact}`;
    wrap.append(a);
    return wrap;
  }
  const digits = contact.replace(/[^\d+]/g, '');
  const call = el('a', null, contact);
  call.href = `tel:${digits}`;
  wrap.append(call);
  // Ugandan numbers like 07xx… become 2567xx… for WhatsApp.
  const wa = digits.replace(/^\+/, '').replace(/^0/, '256');
  if (wa.length >= 9) {
    const w = el('a', 'wa-link', 'WhatsApp');
    w.href = `https://wa.me/${wa}`;
    w.target = '_blank';
    w.rel = 'noopener';
    wrap.append(w);
  }
  return wrap;
}

function drawOrders() {
  const list = filter === 'all' ? orders : orders.filter((o) => (o.status || 'new') === filter);
  $('orders-empty').hidden = list.length > 0;
  $('order-list').replaceChildren(...list.map((o) => {
    const status = o.status || 'new';
    const card = el('article', `order status-${status}`);

    const top = el('div', 'order-top');
    const who = el('div');
    who.append(el('h3', null, o.name), contactLinks(o.contact || ''));
    const meta = el('div', 'order-meta');
    meta.append(el('span', 'tag', o.service || 'Other'), el('time', null, fmtDate(o.createdAt)));
    top.append(who, meta);

    const msg = el('p', 'order-msg', o.message);

    const actions = el('div', 'order-actions');
    const sel = el('select');
    sel.setAttribute('aria-label', `Status of order from ${o.name}`);
    Object.entries(STATUSES).forEach(([value, label]) => {
      const opt = el('option', null, label);
      opt.value = value;
      opt.selected = value === status;
      sel.append(opt);
    });
    sel.addEventListener('change', () => updateOrderStatus(o.id, sel.value).catch(showError));
    const del = el('button', 'link-danger', 'Delete');
    del.addEventListener('click', () => {
      if (confirm(`Delete the order from ${o.name}? This cannot be undone.`)) deleteOrder(o.id).catch(showError);
    });
    actions.append(sel, del);

    card.append(top, msg, actions);
    return card;
  }));
}

/* ---------- Projects ---------- */
let imageData = '';

// Shrink the photo so it is quick to load and fits in the database (< ~900 KB).
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      let q = 0.82;
      let data = canvas.toDataURL('image/jpeg', q);
      while (data.length > 900_000 && q > 0.3) { q -= 0.1; data = canvas.toDataURL('image/jpeg', q); }
      resolve(data);
    };
    img.onerror = () => reject(new Error('That file is not a supported image.'));
    img.src = URL.createObjectURL(file);
  });
}

$('p-image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  imageData = '';
  $('p-preview').hidden = true;
  if (!file) return;
  try {
    imageData = await compressImage(file);
    $('p-preview').src = imageData;
    $('p-preview').hidden = false;
  } catch (err) {
    alert(err.message);
    e.target.value = '';
  }
});

$('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = $('project-note');
  const btn = e.submitter || e.target.querySelector('button');
  btn.disabled = true;
  note.textContent = 'Publishing…';
  note.className = 'form-note';
  try {
    await addProject({
      title: $('p-title').value.trim(),
      category: $('p-category').value,
      description: $('p-desc').value.trim(),
      link: $('p-link').value.trim(),
      image: imageData,
    });
    e.target.reset();
    imageData = '';
    $('p-preview').hidden = true;
    note.textContent = 'Published. It is now visible on the website.';
    note.className = 'form-note success';
  } catch (err) {
    console.error(err);
    note.textContent = DEMO && err.name === 'QuotaExceededError'
      ? 'Browser storage is full (demo mode). Delete a project or use a smaller photo.'
      : 'Could not publish the project. Please try again.';
    note.className = 'form-note error';
  } finally {
    btn.disabled = false;
  }
});

function renderProjects(list) {
  const wrap = $('admin-project-list');
  if (!list.length) {
    wrap.replaceChildren(el('p', 'empty', 'No projects yet. Add your first one and it will appear on the website.'));
    return;
  }
  wrap.replaceChildren(...list.map((p) => {
    const row = el('article', 'admin-project');
    if (p.image) {
      const img = el('img');
      img.src = p.image;
      img.alt = '';
      row.append(img);
    } else {
      row.append(el('div', 'thumb-ph', (p.title || '?').charAt(0)));
    }
    const info = el('div');
    info.append(el('span', 'tag', p.category), el('h3', null, p.title), el('p', null, p.description));
    const del = el('button', 'link-danger', 'Remove');
    del.addEventListener('click', () => {
      if (confirm(`Remove "${p.title}" from the website?`)) deleteProject(p.id).catch(showError);
    });
    row.append(info, del);
    return row;
  }));
}

// Start last, so all state above is initialised before the first render.
onAuth(handleAuth, showDenied);
