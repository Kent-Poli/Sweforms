(() => {
  // Tillfälligt försäljningsstopp: inga köp eller varukorgsåtgärder kan startas.
  // Ändra SALES_PAUSED till false först när kassa och lagersaldo är godkända.
  const params = new URLSearchParams(location.search);
  if (params.get("testbutik") === "1") sessionStorage.setItem("sweforms-test-mode", "1");
  if (params.get("avsluta-test") === "1") sessionStorage.removeItem("sweforms-test-mode");
  const SALES_PAUSED = sessionStorage.getItem("sweforms-test-mode") !== "1";
  if (SALES_PAUSED) {
    try { localStorage.removeItem("sweforms-cart-v1"); } catch {}
    document.querySelectorAll("[data-cart-add], [data-stock-checkout]").forEach(button => {
      button.disabled = true;
      button.textContent = "Slut i lager";
      button.onclick = null;
    });
    document.querySelectorAll("[data-stock]").forEach(label => {
      label.textContent = "Slut i lager";
    });

    // Behåll en synlig varukorg i butiken medan försäljningen är pausad.
    // Ingen produkt kan läggas till och ingen kassa eller Stripe-endpoint anropas.
    const nav = document.querySelector('header nav[aria-label="Huvudmeny"]');
    if (nav) {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "cart-trigger";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", "Öppna varukorgen, 0 varor");
      trigger.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg><span>Varukorg</span><span class="cart-count" aria-hidden="true">0</span>';
      nav.append(trigger);

      const dialog = document.createElement("dialog");
      dialog.className = "cart-dialog";
      dialog.setAttribute("aria-labelledby", "cart-title");
      dialog.innerHTML = '<div class="cart-top"><h2 id="cart-title">Din varukorg</h2><button type="button" data-close aria-label="Stäng varukorgen">✕</button></div><div class="cart-empty"><p>Din varukorg är tom.</p><p>Alla lampskärmar är för tillfället slut i lager. När försäljningen öppnar igen kan du lägga produkter här och gå vidare till Stripe-kassan.</p></div><p class="cart-note">Leverans inom Sverige. Priser inklusive moms.</p>';
      document.body.append(dialog);
      trigger.addEventListener("click", () => dialog.showModal());
      dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    }
    return;
  }
  const products = {
    sommarang: { name: "Sommaräng", image: "/images/sommarang-ljus-studio.png" },
    skogssjo: { name: "Skogssjö", image: "/images/skogssjo-ljus-studio.png" },
    midvinternatt: { name: "Midvinternatt", image: "/images/midvinternatt-ljus-studio.png" }
  };
  const price = 449, shipping = 79, threshold = 1000, key = "sweforms-cart-v1";
  // Set this to the isolated test worker URL after the test environment is deployed.
  const checkoutEndpoint = "https://sweforms-kassa-sandbox.kent-poli.workers.dev/checkout";
  const banner = document.createElement("p");
  banner.setAttribute("role", "status");
  banner.style.cssText = "margin:0;padding:12px;text-align:center;background:#fff1c2;color:#382b00;font-weight:700";
  banner.textContent = "TESTLÄGE: Butiken är under uppbyggnad. Inga riktiga köp eller leveranser görs. Endast testkort får användas.";
  document.body.prepend(banner);
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
  dialog.innerHTML = '<div class="cart-top"><h2 id="cart-title">Varukorg</h2><button type="button" data-close aria-label="Stäng varukorgen">✕</button></div><div data-lines></div><div data-totals aria-live="polite"></div><p class="cart-note">Leverans inom Sverige. Priser inklusive moms.</p><p data-checkout-message role="status"></p><button class="button cart-checkout" type="button" disabled>Kassan är inte aktiverad än</button>';
  document.body.append(dialog);
  const save = () => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch {} render(); };
  function render() {
    const count = Object.values(cart).reduce((a,b) => a+b,0);
    trigger.textContent = "🛒 Varukorg (" + count + ")";
    const pay = dialog.querySelector(".cart-checkout");
    pay.disabled = !count || !checkoutEndpoint;
    pay.textContent = checkoutEndpoint ? "Till kassan" : "Kassan är inte aktiverad än";
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
  dialog.querySelector(".cart-checkout").onclick = async () => {
    const button = dialog.querySelector(".cart-checkout");
    const message = dialog.querySelector("[data-checkout-message]");
    button.disabled = true;
    message.textContent = "";
    try {
      const items = Object.entries(cart).map(([id, quantity]) => ({id, quantity}));
      const response = await fetch(checkoutEndpoint, {method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({items})});
      const data = await response.json();
      if (!response.ok || !data.url || new URL(data.url).origin !== "https://checkout.stripe.com") throw new Error(data.error || "Kunde inte öppna kassan.");
      if (!/^cs_test_[a-zA-Z0-9]+$/.test(data.sessionId || "")) throw new Error("Ogiltig kassa");
      sessionStorage.setItem("sweforms-pending-" + data.sessionId, JSON.stringify(cart));
      location.assign(data.url);
    } catch (error) {
      message.textContent = error.message || "Kassan kunde inte öppnas. Försök igen.";
      button.disabled = false;
    }
  };
  if (new URLSearchParams(location.search).get("checkout") === "cancelled") {
    dialog.querySelector("[data-checkout-message]").textContent = "Köpet avbröts. Din varukorg finns kvar.";
  }
  if (new URLSearchParams(location.search).get("checkout") === "complete") {
    const message = dialog.querySelector("[data-checkout-message]");
    const sessionId = new URLSearchParams(location.search).get("session_id");
    message.textContent = "Kontrollerar betalningen …";
    (async () => {
      try {
        if (!checkoutEndpoint || !/^cs_test_[a-zA-Z0-9]+$/.test(sessionId || "")) throw new Error();
        const response = await fetch(checkoutEndpoint.slice(0, -"checkout".length) + "checkout-status" + "?session_id=" + encodeURIComponent(sessionId));
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!result.paid) {
          message.textContent = "Betalningen behandlas fortfarande. Kontrollera din betalningsbekräftelse.";
          return;
        }
        const pendingKey = "sweforms-pending-" + sessionId;
        const purchased = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
        if (purchased && typeof purchased === "object") {
          for (const id of Object.keys(products)) {
            const qty = purchased[id];
            if (Number.isInteger(qty) && qty > 0 && cart[id]) {
              cart[id] = Math.max(0, cart[id] - qty);
              if (!cart[id]) delete cart[id];
            }
          }
          sessionStorage.removeItem(pendingKey);
          save();
        }
        message.textContent = "Tack för ditt köp! Betalningen är bekräftad.";
      } catch {
        message.textContent = "Vi kunde inte kontrollera betalningen just nu. Kontrollera din betalningsbekräftelse eller kontakta oss.";
      }
    })();
  }
  if (["complete", "cancelled"].includes(new URLSearchParams(location.search).get("checkout"))) dialog.showModal();
  trigger.onclick = () => dialog.showModal();
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  for (const button of document.querySelectorAll("[data-cart-add]")) {
    const id = button.dataset.cartAdd;
    if (!products[id]) continue;
    button.onclick = () => { cart[id] = Math.min((cart[id] || 0) + 1, 99); save(); dialog.showModal(); };
    fetch("https://sweforms-kassa-sandbox.kent-poli.workers.dev/lagersaldo.json", {cache:"no-store"})
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(stock => { if (Number.isInteger(stock[id]) && stock[id] > 0) { button.disabled = false; button.textContent = "Lägg i varukorgen"; document.querySelectorAll(`[data-stock="${id}"]`).forEach(label => label.textContent = `${stock[id]} st i testlager`); } else if (stock[id] === 0) { button.textContent = "Slut i lager"; } else { button.textContent = "Lagersaldo otillgängligt"; } })
      .catch(() => { button.textContent = "Lagersaldo otillgängligt"; });
  }
  window.addEventListener("storage", event => { if (event.key === key) location.reload(); });
  render();
})();