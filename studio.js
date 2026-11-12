// Public Stripe Payment Links only. Never put API keys in this static website.
// Launch stays disabled until real product information and shop terms are published.
const studioShop = Object.freeze({ ready: false, paymentLink: "" });
function approvedPaymentLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'buy.stripe.com' &&
      !url.username && !url.password && !url.port && /^\/[A-Za-z0-9]+$/.test(url.pathname)
      ? url.href : null;
  } catch { return null; }
}
const checkout = document.getElementById('checkout');
const paymentUrl = approvedPaymentLink(studioShop.paymentLink);
if (checkout && studioShop.ready && paymentUrl) {
  checkout.href = paymentUrl;
  checkout.hidden = false;
  document.getElementById('availability').textContent = 'Fortsätt till betalning hos Stripe.';
}

document.querySelectorAll('.product-gallery').forEach(gallery => {
  const mainImage = gallery.querySelector('.product-gallery-main img');
  const caption = gallery.querySelector('figcaption');
  const thumbnails = gallery.querySelectorAll('.product-gallery-thumbnails a');

  thumbnails.forEach(thumbnail => {
    thumbnail.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const preview = thumbnail.querySelector('img');
      mainImage.src = thumbnail.href;
      mainImage.alt = preview.alt;
      mainImage.setAttribute('width', preview.getAttribute('width'));
      mainImage.setAttribute('height', preview.getAttribute('height'));
      caption.textContent = thumbnail.querySelector('span').textContent;

      gallery.querySelector('[aria-current="true"]').removeAttribute('aria-current');
      thumbnail.setAttribute('aria-current', 'true');
    });
  });
});
