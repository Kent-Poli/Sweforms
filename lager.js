const stockLabels = document.querySelectorAll("[data-stock]");
const checkoutButtons = document.querySelectorAll("[data-stock-checkout]");

function checkoutState(quantity, paymentLink) {
  if (quantity === 0) return { text: "Slut i lager" };
  if (!paymentLink) return { text: "Kommer snart" };
  if (!Number.isInteger(quantity) || quantity < 1) return { text: "Lagersaldo otillgängligt" };
  try {
    const url = new URL(paymentLink);
    if (url.origin === "https://buy.stripe.com" && !url.username && !url.password &&
        /^\/[A-Za-z0-9]+$/.test(url.pathname)) return { text: "Köp", url: url.href };
  } catch {
    // An invalid payment link keeps checkout closed.
  }
  return { text: "Kommer snart" };
}

function renderCheckout(button, quantity) {
  const state = checkoutState(quantity, button.dataset.paymentLink);
  button.textContent = state.text;
  button.disabled = !state.url;
  button.onclick = state.url ? () => refreshCheckout(button) : null;
}

async function readStock() {
  const response = await fetch("https://sweforms-stripe-test.kent-poli.workers.dev/lagersaldo.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Inventory unavailable");
  return response.json();
}

async function refreshCheckout(button) {
  button.disabled = true;
  try {
    const stock = await readStock();
    const quantity = stock[button.dataset.stockCheckout];
    const state = checkoutState(quantity, button.dataset.paymentLink);
    renderCheckout(button, quantity);
    if (state.url) {
      window.location.assign(state.url);
      return;
    }
    updateStock();
  } catch {
    renderCheckout(button, undefined);
  }
}

async function updateStock() {
  for (const button of checkoutButtons) button.disabled = true;
  try {
    const stock = await readStock();
    for (const label of stockLabels) {
      const quantity = stock[label.dataset.stock];
      label.textContent = Number.isInteger(quantity) && quantity >= 0
        ? quantity === 0 ? "Slut i lager" : `${quantity} st i lager`
        : "Lagersaldo visas när det är angivet.";
    }
    for (const button of checkoutButtons) renderCheckout(button, stock[button.dataset.stockCheckout]);
  } catch {
    for (const label of stockLabels) label.textContent = "Lagersaldo tillfälligt otillgängligt.";
    for (const button of checkoutButtons) renderCheckout(button, undefined);
  }
}

if (stockLabels.length || checkoutButtons.length) {
  updateStock();
  window.addEventListener("pageshow", event => { if (event.persisted) updateStock(); });
}
