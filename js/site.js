// Public-site features backed by the database: saving orders and showing projects.
import { addOrder, watchProjects } from './db.js';

window.glodireSaveOrder = addOrder;

const grid = document.getElementById('projects-grid');
const empty = document.getElementById('projects-empty');

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

function projectCard(p) {
  const card = document.createElement('article');
  card.className = 'project';

  if (p.image) {
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.title;
    img.loading = 'lazy';
    card.append(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'project-ph';
    ph.textContent = (p.title || '?').charAt(0);
    card.append(ph);
  }

  const body = document.createElement('div');
  body.className = 'project-body';

  if (p.category) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = p.category;
    body.append(tag);
  }

  const h3 = document.createElement('h3');
  h3.textContent = p.title;
  const desc = document.createElement('p');
  desc.textContent = p.description || '';
  body.append(h3, desc);

  const url = safeUrl(p.link);
  if (url) {
    const a = document.createElement('a');
    a.className = 'read-more';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'View project';
    body.append(a);
  }

  card.append(body);
  return card;
}

watchProjects((projects) => {
  grid.replaceChildren(...projects.map(projectCard));
  empty.hidden = projects.length > 0;
}, (err) => {
  console.error(err);
  empty.hidden = false;
});
