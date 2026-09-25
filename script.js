
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


const formsMotion = document.getElementById('formsMotion');
if (formsMotion) {
  const wordEl = document.getElementById('fmWord');
  const words = ['FORM', 'YTA', 'NIVÅ', 'TEKNIK'];
  let wordIndex = 0;
  let frame = 0;
  let startedAt = 0;

  const animateFormsMotion = (time) => {
    if (!startedAt) startedAt = time;
    const t = time - startedAt;

    const scan = -18 + ((t % 9000) / 9000) * 136;
    formsMotion.style.setProperty('--scan', scan.toFixed(2) + '%');
    formsMotion.style.setProperty('--fa', (Math.sin(t / 1200) * 9).toFixed(2) + 'px');
    formsMotion.style.setProperty('--fb', (Math.sin(t / 1550 + 1.4) * 11).toFixed(2) + 'px');
    formsMotion.style.setProperty('--fc', (Math.sin(t / 980 + 2.2) * 7).toFixed(2) + 'px');
    formsMotion.style.setProperty('--ra', ((t / 130) % 360).toFixed(2) + 'deg');
    formsMotion.style.setProperty('--rb', ((-t / 170) % 360).toFixed(2) + 'deg');
    formsMotion.style.setProperty('--rc', ((t / 210) % 360).toFixed(2) + 'deg');

    frame = requestAnimationFrame(animateFormsMotion);
  };

  frame = requestAnimationFrame(animateFormsMotion);

  const wordTimer = window.setInterval(() => {
    if (!wordEl) return;
    wordEl.classList.add('is-changing');
    window.setTimeout(() => {
      wordIndex = (wordIndex + 1) % words.length;
      wordEl.textContent = words[wordIndex];
      wordEl.classList.remove('is-changing');
    }, 220);
  }, 1900);

  if (window.matchMedia('(pointer:fine)').matches) {
    formsMotion.addEventListener('pointermove', (e) => {
      const r = formsMotion.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 24;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 18;
      formsMotion.style.setProperty('--mx', x.toFixed(2) + 'px');
      formsMotion.style.setProperty('--my', y.toFixed(2) + 'px');
    });
    formsMotion.addEventListener('pointerleave', () => {
      formsMotion.style.setProperty('--mx', '0px');
      formsMotion.style.setProperty('--my', '0px');
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!frame) {
      startedAt = 0;
      frame = requestAnimationFrame(animateFormsMotion);
    }
  });
}
