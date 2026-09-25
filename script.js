
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


const formMachine = document.getElementById('formMachine');
if (formMachine && window.matchMedia('(pointer:fine)').matches) {
  formMachine.addEventListener('pointermove', (e) => {
    const r = formMachine.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 18;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 14;
    formMachine.style.setProperty('--mx', x + 'px');
    formMachine.style.setProperty('--my', y + 'px');
  });
  formMachine.addEventListener('pointerleave', () => {
    formMachine.style.setProperty('--mx', '0px');
    formMachine.style.setProperty('--my', '0px');
  });
}
