const orderIdPattern = /^cs_(test|live)_[a-zA-Z0-9]+$/;
const paymentIdPattern = /^pi_[a-zA-Z0-9]+$/;
const encoder = new TextEncoder();
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm",
});
const columns = [
  { status: "new", label: "Nya", next: ["packed", "Markera som packad"] },
  { status: "packed", label: "Packade", next: ["shipped", "Markera som skickad"], back: ["new", "Flytta till Nya"] },
  { status: "shipped", label: "Skickade", back: ["packed", "Flytta till Packade"] },
];

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function reply(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...headers, ...extra } });
}

async function verifyStripe(body, signature, secret) {
  const fields = signature.split(",").map(field => field.trim());
  const timestamp = fields.find(field => /^t=\d+$/.test(field))?.slice(2);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  const prefix = encoder.encode(timestamp + ".");
  const signed = new Uint8Array(prefix.length + body.byteLength);
  signed.set(prefix);
  signed.set(new Uint8Array(body), prefix.length);

  for (const field of fields) {
    if (!/^v1=[0-9a-f]{64}$/i.test(field)) continue;
    const digest = Uint8Array.from(field.slice(3).match(/../g), hex => parseInt(hex, 16));
    if (await crypto.subtle.verify("HMAC", key, digest, signed)) return true;
  }
  return false;
}

async function stripeWebhook(request, env) {
  if (request.method !== "POST") return reply("Method not allowed", 405, { Allow: "POST" });
  if (!env.STRIPE_WEBHOOK_SECRET || !["live", "test"].includes(env.STRIPE_MODE)) {
    return reply("Webhook unavailable", 503);
  }
  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return reply("Missing signature", 400);
  const maxBytes = 256 * 1024;
  if (!request.body) return reply("Missing body", 400);
  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxBytes);
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (bytes + value.length > maxBytes) {
      await reader.cancel();
      return reply("Payload too large", 413);
    }
    buffer.set(value, bytes);
    bytes += value.length;
  }
  const body = buffer.subarray(0, bytes);
  if (!await verifyStripe(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return reply("Invalid signature", 400);
  }
  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return reply("Invalid JSON", 400);
  }
  if (event?.livemode !== (env.STRIPE_MODE === "live")) return reply("Wrong Stripe mode", 400);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return reply("Ignored");
  }

  const session = event.data?.object;
  if (!session || session.mode !== "payment" || session.payment_status !== "paid") return reply("Ignored");
  if (!orderIdPattern.test(session.id) || !session.id.startsWith(`cs_${env.STRIPE_MODE}_`) ||
      !paymentIdPattern.test(session.payment_intent) ||
      !Number.isSafeInteger(event.created) || event.created <= 0 || event.created > Date.now() / 1000 + 300) {
    return reply("Invalid Checkout event", 400);
  }
  // Stripe can deliver both event types or retry a delivery after the order has moved.
  await env.DB.prepare(`
    INSERT INTO orders (session_id, payment_id, paid_at)
    VALUES (?, ?, ?) ON CONFLICT(session_id) DO NOTHING
  `).bind(session.id, session.payment_intent, event.created).run();
  return reply("OK");
}

async function ownerAuthenticated(env, context) {
  if (!env.ACCESS_AUD || !env.OWNER_EMAIL || context.access?.aud !== env.ACCESS_AUD) return false;
  const identity = await context.access.getIdentity();
  return identity?.email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}

async function updateOrder(request, url, env) {
  if (request.headers.get("Origin") !== url.origin) return reply("Otillåten begäran", 403);
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return reply("Ogiltigt formulär", 415);
  }
  const form = await request.formData();
  const id = Number(form.get("id"));
  const from = form.get("from");
  const to = form.get("to");
  const column = columns.find(column => column.status === from);
  if (!Number.isSafeInteger(id) || id <= 0 || !column ||
      (to !== column.next?.[0] && to !== column.back?.[0])) {
    return reply("Ogiltig orderstatus", 400);
  }
  const result = await env.DB.prepare(`
    UPDATE orders SET status = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER)
    WHERE id = ? AND status = ?
  `).bind(to, id, from).run();
  return reply(null, 303, { Location: result.meta.changes ? "/" : "/?status=changed" });
}

async function createTestOrder(request, url, env) {
  if (request.headers.get("Origin") !== url.origin) return reply("Otillåten begäran", 403);
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return reply("Ogiltigt formulär", 415);
  }
  const token = (await request.formData()).get("token");
  if (typeof token !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(token)) {
    return reply("Ogiltig testbeställning", 400);
  }
  const result = await env.DB.prepare(`
    INSERT INTO orders (session_id, payment_id, paid_at)
    VALUES (?, '', ?) ON CONFLICT(session_id) DO NOTHING
  `).bind(`trial_${token}`, Math.floor(Date.now() / 1000)).run();
  if (!result.meta.changes) return reply(null, 303, { Location: "/?test=duplicate" });
  if (!env.RESEND_API_KEY) return reply(null, 303, { Location: "/?test=no-email" });

  let accepted = false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `sweforms-trial-${token}`,
      },
      body: JSON.stringify({
        from: "SweForms <onboarding@resend.dev>",
        to: [env.OWNER_EMAIL],
        subject: `SweForms: Testbeställning #${result.meta.last_row_id}`,
        text: `En testbeställning har lagts för en lampskärm med vintermotiv. Ingen betalning gjordes.\n\nÖppna ordersidan: ${url.origin}/`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    accepted = response.ok;
  } catch {
    // The test order is already saved. Report email status separately.
  }
  return reply(null, 303, { Location: accepted ? "/?test=email-accepted" : "/?test=email-error" });
}

function testCheckout() {
  return reply(`<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Testköp | SweForms</title>
<style>
  body { margin: 40px auto; padding: 0 20px; max-width: 550px; background: #faf9f6;
    color: #202e2e; font: 16px/1.5 system-ui, sans-serif; }
  a { color: #075c64; } h1 { font: 42px Georgia, serif; }
  button { padding: 12px 20px; border: 0; border-radius: 5px; background: #06636b;
    color: white; font: inherit; cursor: pointer; }
</style></head><body><main>
  <a href="/">← Till beställningar</a>
  <h1>Lampskärm med vintermotiv</h1>
  <p>Provbeställning · 1 st · 0 kr</p>
  <p>Beställningen sparas som en testorder. Ingen betalning eller leverans görs.</p>
  <form action="/testkop" method="post">
    <input type="hidden" name="token" value="${crypto.randomUUID()}">
    <button type="submit">Gör testköp</button>
  </form>
</main></body></html>`, 200, { "Content-Type": "text/html; charset=utf-8" });
}

async function manageTestArchive(request, url, env) {
  if (request.headers.get("Origin") !== url.origin) return reply("Otillåten begäran", 403);
  const action = url.pathname === "/arkivera-testordrar";
  if (action) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO archived_test_orders (order_id)
      SELECT id FROM orders WHERE substr(session_id, 1, 6) = 'trial_'
    `).run();
  } else {
    await env.DB.prepare("DELETE FROM archived_test_orders").run();
  }
  return reply(null, 303, { Location: action ? "/?test=archived" : "/?test=restored" });
}

function orderCard(order, column) {
  const isTrial = order.session_id.startsWith("trial_");
  const stripeMode = order.session_id.startsWith("cs_test_") ? "/test" : "";
  const paymentLink = paymentIdPattern.test(order.payment_id)
    ? `<a href="https://dashboard.stripe.com${stripeMode}/payments/${order.payment_id}" target="_blank" rel="noopener noreferrer">Öppna ordern i Stripe ↗</a>`
    : "";
  const buttons = [column.next, column.back].filter(Boolean).map(([status, label]) =>
    `<button type="submit" name="to" value="${status}"${status === column.back?.[0] ? ' class="secondary"' : ""}>${label}</button>`
  ).join("");
  return `<li>
    <h3>${isTrial ? "Testorder" : "Order"} #${order.id}</h3>
    ${isTrial ? "<p>Lampskärm med vintermotiv · 1 st · 0 kr</p>" : ""}
    <p>${isTrial ? "Skapad" : "Betald"} ${dateFormat.format(order.paid_at * 1000)}</p>
    ${paymentLink}
    <form action="/status" method="post">
      <input type="hidden" name="id" value="${order.id}">
      <input type="hidden" name="from" value="${column.status}">
      ${buttons}
    </form>
  </li>`;
}

async function orderPage(url, env) {
  const testMessages = {
    "no-email": "Testordern sparades. Mejlavisering är inte ansluten ännu.",
    "email-accepted": "Testordern sparades och mejlet lämnades till e-posttjänsten.",
    "email-error": "Testordern sparades. E-posttjänsten bekräftade inte utskicket.",
    duplicate: "Testordern är redan registrerad.",
    archived: "Testordrarna har arkiverats.",
    restored: "Testordrarna visas igen.",
  };
  const testResult = url.searchParams.get("test");
  const testMessage = Object.hasOwn(testMessages, testResult) ? testMessages[testResult] : "";
  const { results } = await env.DB.prepare(`
    SELECT id, session_id, payment_id, paid_at, status FROM orders
    WHERE id NOT IN (SELECT order_id FROM archived_test_orders)
      AND (status IN ('new', 'packed') OR id IN (
        SELECT id FROM orders WHERE status = 'shipped'
          AND id NOT IN (SELECT order_id FROM archived_test_orders)
        ORDER BY updated_at DESC, id DESC LIMIT 50
      ))
    ORDER BY paid_at DESC, id DESC
  `).all();
  const archived = await env.DB.prepare("SELECT count(*) AS count FROM archived_test_orders").first();
  const hasVisibleTestOrders = results.some(order => order.session_id.startsWith("trial_"));
  const board = columns.map(column => {
    const orders = results.filter(order => order.status === column.status);
    const content = orders.length
      ? `<ul>${orders.map(order => orderCard(order, column)).join("")}</ul>`
      : "<p>Inga beställningar.</p>";
    return `<section><h2>${column.label} <small>${orders.length}</small></h2>
      ${column.status === "shipped" && orders.length === 50 ? "<p>Visar de 50 senast skickade.</p>" : ""}
      ${content}</section>`;
  }).join("");

  return reply(`<!doctype html>
<html lang="sv"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60;url=/">
<title>Beställningar | SweForms</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #faf9f6; color: #202e2e; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 1120px; margin: auto; padding: 32px 20px; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; align-items: center; }
  h1 { font: 42px Georgia, serif; margin: 4px 0 0; }
  h2, h3, p { margin: 0 0 10px; }
  h2 { font-size: 19px; } h3 { font-size: 17px; }
  small, p { color: #4c625d; }
  a { color: #075c64; text-underline-offset: 3px; }
  .board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
  section { background: #eef1ec; border-radius: 12px; padding: 16px; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
  li { border-radius: 8px; padding: 14px; background: white; }
  form { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  button { cursor: pointer; padding: 8px 12px; border: 1px solid #06636b; border-radius: 5px;
    color: white; background: #06636b; font: inherit; font-size: 14px; min-height: 44px; }
  button.secondary { color: #075c64; background: white; }
  :focus-visible { outline: 3px solid #075c64; outline-offset: 3px; }
  .notice { padding: 10px; background: #fff0d2; }
  @media (max-width: 760px) { .board { grid-template-columns: 1fr; } }
</style></head>
<body><main>
  <header><div><strong>SweForms</strong><h1>Beställningar</h1></div><div><a href="/testkop">Testköp</a> · <a href="/">Uppdatera</a></div></header>
  <p>Sidan uppdateras varje minut.</p>
  ${testMessage ? `<p class="notice" role="status">${testMessage}</p>` : ""}
  ${!env.STRIPE_WEBHOOK_SECRET
    ? '<p class="notice">Stripe är inte anslutet ännu. Nya beställningar visas här när betalningar har aktiverats.</p>'
    : env.STRIPE_MODE === "test" ? '<p class="notice">Stripe är i testläge.</p>' : ""}
  ${url.searchParams.get("status") === "changed" ? '<p class="notice" role="status">Orderns status har redan ändrats. Kontrollera listan och försök igen.</p>' : ""}
  <div class="board">${board}</div>
  ${hasVisibleTestOrders ? '<form action="/arkivera-testordrar" method="post"><button class="secondary">Arkivera testordrar</button></form>' : ""}
  ${archived.count ? `<form action="/aterstall-testordrar" method="post"><button class="secondary">Visa arkiverade testordrar (${archived.count})</button></form>` : ""}
</main></body></html>`, 200, { "Content-Type": "text/html; charset=utf-8" });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/stripe-webhook") return await stripeWebhook(request, env);
      if (!await ownerAuthenticated(env, context)) return reply("Inloggning krävs", 403);
      if (url.pathname === "/" && request.method === "GET") return await orderPage(url, env);
      if (url.pathname === "/testkop" && request.method === "GET") return testCheckout();
      if (url.pathname === "/testkop" && request.method === "POST") return await createTestOrder(request, url, env);
      if (request.method === "POST" &&
          ["/arkivera-testordrar", "/aterstall-testordrar"].includes(url.pathname)) {
        return await manageTestArchive(request, url, env);
      }
      if (url.pathname === "/status" && request.method === "POST") return await updateOrder(request, url, env);
      return reply("Sidan hittades inte", 404);
    } catch {
      return reply("Ett tillfälligt fel uppstod. Försök igen.", 500);
    }
  },
};
