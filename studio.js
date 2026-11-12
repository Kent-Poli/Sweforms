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
  document.getElementById('availability').textContent = 'Continue to secure payment with Stripe.';
}
