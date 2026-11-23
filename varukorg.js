(() => {
  const products = {
    sommarang: { name: "Sommaräng", image: "/images/sommarang-ljus-studio.png" },
    skogssjo: { name: "Skogssjö", image: "/images/skogssjo-ljus-studio.png" },
    midvinternatt: { name: "Midvinternatt", image: "/images/midvinternatt-ljus-studio.png" }
  };
  const price = 449, shipping = 79, threshold = 1000, key = "sweforms-cart-v1";
  let cart = {};
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    for (const id of Object.keys(products)) {
      if (Number.isInteger(saved[id]) && saved[id] > 0 && saved[id] <= 99) cart[id] = saved[id];
    }
  } catch {}
  const nav = document.querySelector('header nav[aria-label="Huvudmeny"]');
  if (!nav) return;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cart-trigger";
  trigger.setAttribute("aria-label", "Öppna varukorgen");
  nav.append(trigger);
  const dialog = document.createElement("dialog");
  dialog.className = "cart-dialog";
  dialog.setAttribute("aria-labelledby", "cart-title");
  dialog.innerHTML = '<div class="cart-top"><h2 id="cart-title">Varukorg</h2><button type="button" data-close aria-label="Stäng varukorgen">✕</button></div><div data-lines></div><div data-totals aria-live="polite"></div><p class="cart-note">Leverans inom Sverige. Priser inklusive moms.</p><button class="button cart-checkout" type="button" disabled>Kassan är inte aktiverad än</button>';
  document.body.append(dialog);
  const save = () => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch {} render(); };
  function render() {
    const count = Object.values(cart).reduce((a,b) => a+b,0);
    trigger.textContent = "🛒 Varukorg (" + count + ")";
    const lines = dialog.querySelector("[data-lines]");
    lines.replaceChildren();
    for (const [id, quantity] of Object.entries(cart)) {
      const item = document.createElement("div");
      item.className = "cart-line";
      item.innerHTML = '<img alt="" src="' + products[id].image + '"><div><strong>' + products[id].name + '</strong><br>449 kr/st<br><button type="button" data-minus aria-label="Minska antal">−</button> <span>' + quantity + '</span> <button type="button" data-plus aria-label="Öka antal">+</button> <button type="button" data-remove>Ta bort</button></div>';
      item.querySelector("[data-minus]").onclick = () => { if (cart[id] > 1) cart[id]--; else delete cart[id]; save(); };
      item.querySelector("[data-plus]").onclick = () => { if (cart[id] < 99) cart[id]++; save(); };
      item.querySelector("[data-remove]").onclick = () => { delete cart[id]; save(); };
      lines.append(item);
    }
    const subtotal = count * price, delivery = count && subtotal < threshold ? shipping : 0;
    if (!count) lines.textContent = "Din varukorg är tom.";
    dialog.querySelector("[data-totals]").innerHTML = '<p>Varor: <strong>' + subtotal + ' kr</strong><br>Frakt: <strong>' + delivery + ' kr</strong><br>Totalt: <strong>' + (subtotal + delivery) + ' kr</strong></p><p>' + (subtotal >= threshold ? 'Du har fri frakt!' : 'Handla för ' + (threshold-subtotal) + ' kr till för fri frakt.') + '</p>';
  }
  trigger.onclick = () => dialog.showModal();
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  for (const button of document.querySelectorAll("[data-cart-add]")) {
    const id = button.dataset.cartAdd;
    if (!products[id]) continue;
    button.onclick = () => { cart[id] = Math.min((cart[id] || 0) + 1, 99); save(); dialog.showModal(); };
    fetch("https://sweforms-stripe-test.kent-poli.workers.dev/lagersaldo.json", {cache:"no-store"})
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(stock => { if (Number.isInteger(stock[id]) && stock[id] > 0) { button.disabled = false; button.textContent = "Lägg i varukorgen"; } else { button.textContent = "Slut i lager"; } })
      .catch(() => { button.textContent = "Lagersaldo otillgängligt"; });
  }
  window.addEventListener("storage", event => { if (event.key === key) location.reload(); });
  render();
})();