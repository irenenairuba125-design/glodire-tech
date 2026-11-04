// Mobile navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  });
});

// Header shadow on scroll
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Order / contact form. js/site.js (a module) provides window.glodireSaveOrder,
// which stores the order so staff can see it on admin.html. If that is not
// available or fails, we fall back to opening the visitor's email app.
const form = document.getElementById('contact-form');
const note = document.getElementById('form-note');
const submitBtn = form.querySelector('button[type="submit"]');
const COMPANY_EMAIL = 'glodiretech@gmail.com';

const showNote = (text, type) => {
  note.textContent = text;
  note.className = `form-note ${type}`;
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const order = {
    name: data.get('name').trim(),
    contact: data.get('phone').trim(),
    service: data.get('service'),
    message: data.get('message').trim(),
  };

  if (!order.name || !order.contact || !order.message) {
    showNote('Please fill in your name, contact and message.', 'error');
    return;
  }

  if (window.glodireSaveOrder) {
    submitBtn.disabled = true;
    showNote('Sending…', '');
    try {
      await window.glodireSaveOrder(order);
      showNote('Thank you! Your order has been received. We will contact you soon.', 'success');
      form.reset();
      return;
    } catch (err) {
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  }

  const subject = `Order: ${order.service} from ${order.name}`;
  const body = `Name: ${order.name}
Contact: ${order.contact}
Service: ${order.service}

${order.message}`;
  window.location.href =
    `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  showNote('Opening your email app… If nothing happens, call us on +256 752 257694.', 'success');
  form.reset();
});

// Blog "Read more" toggles
document.querySelectorAll('.read-more').forEach((btn) => {
  const more = document.getElementById(btn.getAttribute('aria-controls'));
  btn.addEventListener('click', () => {
    const open = more.hidden;
    more.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? 'Show less' : 'Read more';
  });
});

// Reveal-on-scroll animation
const revealEls = document.querySelectorAll('.service, .founder, .values li, .post');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}
