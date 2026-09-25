
const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}
document.querySelectorAll('.reveal').forEach(el => {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  io.observe(el);
});
document.querySelectorAll('.year').forEach(el => el.textContent = new Date().getFullYear());
const offerForm = document.getElementById('offerForm');
if (offerForm) {
  offerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id)?.value.trim() || '';
    const subject = 'Förfrågan från sweforms.se';
    const body = [
      g('name') ? `Namn: ${g('name')}` : '',
      g('email') ? `E-post: ${g('email')}` : '',
      g('phone') ? `Telefon: ${g('phone')}` : '',
      g('service') ? `Tjänst: ${g('service')}` : '',
      '',
      g('message') || 'Hej, jag vill veta mer om era tjänster.'
    ].filter(Boolean).join('\n');
    window.location.href = `mailto:offert@sweforms.se?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}


const kineticBanner = document.getElementById('kineticBanner');
if (kineticBanner && window.matchMedia('(pointer:fine)').matches) {
  kineticBanner.addEventListener('pointermove', (e) => {
    const r = kineticBanner.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    kineticBanner.style.setProperty('--kx', ((nx - 0.5) * 20).toFixed(2) + 'px');
    kineticBanner.style.setProperty('--ky', ((ny - 0.5) * 14).toFixed(2) + 'px');
    kineticBanner.style.setProperty('--px', (nx * 100).toFixed(1) + '%');
    kineticBanner.style.setProperty('--py', (ny * 100).toFixed(1) + '%');
  });
  kineticBanner.addEventListener('pointerleave', () => {
    kineticBanner.style.setProperty('--kx', '0px');
    kineticBanner.style.setProperty('--ky', '0px');
    kineticBanner.style.setProperty('--px', '50%');
    kineticBanner.style.setProperty('--py', '50%');
  });
}
