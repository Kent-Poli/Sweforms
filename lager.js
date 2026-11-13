const stockLabels = document.querySelectorAll("[data-stock]");

async function updateStock() {
  try {
    const response = await fetch("https://sweforms-stripe-test.kent-poli.workers.dev/lagersaldo.json");
    if (!response.ok) throw new Error("Inventory unavailable");
    const stock = await response.json();
    for (const label of stockLabels) {
      const quantity = stock[label.dataset.stock];
      if (Number.isInteger(quantity) && quantity >= 0) {
        label.textContent = quantity === 0 ? "Slut i lager" : `${quantity} st i lager`;
      }
    }
  } catch {
    for (const label of stockLabels) label.textContent = "Lagersaldo tillfälligt otillgängligt.";
  }
}

if (stockLabels.length) {
  updateStock();
  window.addEventListener("pageshow", event => { if (event.persisted) updateStock(); });
}
