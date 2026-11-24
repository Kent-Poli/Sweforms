// Test-only Stripe Checkout worker. Configure secrets and an isolated preview origin before deployment.
const PRODUCTS = Object.freeze({
  sommarang: "price_1UetnxF5PTt3WP4l3I4QRLWm",
  skogssjo: "price_1UetkfF5PTt3WP4lA9IyJuzZ",
  midvinternatt: "price_1UetbeF5PTt3WP4lxg9UIh1L"
});
const SHIPPING = { paid: "shr_1UetsEF5PTt3WP4lHyexLo2S", free: "shr_1UetsmF5PTt3WP4lU6KoL3iM" };
const PRICE = 44900, THRESHOLD = 100000;
const PRODUCT_TAX_RATE = "txr_1UeuhIF5PTt3WP4lNnzfAgql";
function reply(body, status, origin) {
  return new Response(JSON.stringify(body), {status, headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store",
    ...(origin ? {"Access-Control-Allow-Origin": origin, "Vary": "Origin"} : {})
  }});
}
async function stripe(path, env, options = {}) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    ...options, headers: {Authorization: "Bearer " + env.STRIPE_SECRET_KEY, ...options.headers}
  });
  if (!res.ok) throw new Error("Stripe API unavailable");
  return res.json();
}
async function reserveStock(db, id, items) {
  const quantities = JSON.stringify(Object.fromEntries(items.map(i => [i.id, i.quantity])));
  // One atomic SQLite statement checks and inserts all products together.
  const result = await db.prepare(`INSERT INTO reservations(id,items,status)
    SELECT ?, ?, 'held' WHERE NOT EXISTS (
      SELECT 1 FROM json_each(?) wanted LEFT JOIN inventory i ON i.sku=wanted.key
      WHERE i.sku IS NULL OR i.quantity - COALESCE((
        SELECT SUM(CAST(json_extract(r.items, '$.' || wanted.key) AS INTEGER))
        FROM reservations r WHERE r.status='held'),0) < CAST(wanted.value AS INTEGER)
    )`).bind(id, quantities, quantities).run();
  return result.meta.changes === 1;
}
async function settleStock(db, reservationId, paid, session) {
  if (paid) {
    // Register the verified order and adjust stock in the same transaction.
    const paymentId = typeof session?.payment_intent === "string" ? session.payment_intent : session?.payment_intent?.id;
    if (!/^cs_test_[A-Za-z0-9]+$/.test(session?.id || "") || !/^pi_[A-Za-z0-9]+$/.test(paymentId || "")) throw new Error("Invalid paid session");
    const paidAt = Math.floor(Date.now() / 1000);
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO orders(session_id,payment_id,paid_at,status)
        SELECT ?, ?, ?, 'new' WHERE EXISTS
        (SELECT 1 FROM reservations WHERE id=? AND status='held')`).bind(session.id,paymentId,paidAt,reservationId),
      db.prepare(`UPDATE inventory SET quantity=quantity-CAST(json_extract(
        (SELECT items FROM reservations WHERE id=?), '$.'||sku) AS INTEGER)
        WHERE json_extract((SELECT items FROM reservations WHERE id=? AND status='held'), '$.'||sku) IS NOT NULL`).bind(reservationId,reservationId),
      db.prepare("UPDATE reservations SET status='paid' WHERE id=? AND status='held'").bind(reservationId)
    ]);
    // Do not acknowledge a payment unless both the order and reservation are recorded.
    // Stripe can retry when an event arrives after a reservation was released.
    const recorded = await db.prepare(`SELECT 1 AS ok FROM orders o JOIN reservations r
      ON r.id=? AND r.status='paid' WHERE o.session_id=? AND o.payment_id=?`)
      .bind(reservationId,session.id,paymentId).first();
    if (!recorded) throw new Error("Paid order needs reconciliation");
  } else {
    await db.prepare("UPDATE reservations SET status='released' WHERE id=? AND status='held'").bind(reservationId).run();
  }
}
async function availableStock(request, env) {
  const origin = request.headers.get("Origin");
  if (!env.PREVIEW_ORIGIN || origin !== env.PREVIEW_ORIGIN || !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !env.STOCK_DB) return reply({error:"Not configured"},403);
  const result = await env.STOCK_DB.prepare(`SELECT i.sku, i.quantity - COALESCE((
    SELECT SUM(CAST(json_extract(r.items, '$.' || i.sku) AS INTEGER))
    FROM reservations r WHERE r.status='held'),0) AS available FROM inventory i`).all();
  const stock = {};
  for (const row of result.results) {
    if (Object.hasOwn(PRODUCTS,row.sku) && Number.isInteger(row.available) && row.available >= 0) stock[row.sku] = row.available;
  }
  if (Object.keys(stock).length !== Object.keys(PRODUCTS).length) throw new Error("Invalid inventory");
  return reply(stock,200,origin);
}
async function checkout(req, env) {
  const origin = req.headers.get("Origin");
  if (!env.PREVIEW_ORIGIN || origin !== env.PREVIEW_ORIGIN || !env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) return reply({error:"Kassan är inte konfigurerad."}, 403);
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) return reply({error:"Ogiltig förfrågan."}, 400, origin);
  const input = await req.json();
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 3) return reply({error:"Ogiltig varukorg."}, 400, origin);
  const seen = new Set();
  for (const item of input.items) {
    if (!item || !Object.hasOwn(PRODUCTS,item.id) || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return reply({error:"Ogiltig varukorg."},400,origin);
    seen.add(item.id);
  }
  if (!env.STOCK_DB) return reply({error:"Lagersaldot är tillfälligt otillgängligt."},503,origin);
  const priceObjects = await Promise.all(input.items.map(i => stripe("prices/" + PRODUCTS[i.id],env)));
  if (priceObjects.some(p => !p.active || p.currency !== "sek" || p.unit_amount !== PRICE || p.livemode)) return reply({error:"Priset kunde inte verifieras."},503,origin);
  const subtotal = input.items.reduce((sum,item) => sum + item.quantity * PRICE, 0);
  const selectedShipping = subtotal >= THRESHOLD ? SHIPPING.free : SHIPPING.paid;
  const rate = await stripe("shipping_rates/" + selectedShipping,env);
  if (!rate.active || rate.livemode || rate.fixed_amount?.currency !== "sek" || rate.fixed_amount?.amount !== (subtotal >= THRESHOLD ? 0 : 7900)) return reply({error:"Fraktpriset kunde inte verifieras."},503,origin);
  const reservationId = crypto.randomUUID();
  if (!await reserveStock(env.STOCK_DB,reservationId,input.items)) return reply({error:"Lagersaldot har ändrats. Kontrollera varukorgen."},409,origin);
  const form = new URLSearchParams();
  form.set("mode","payment");
  form.set("metadata[reservation_id]",reservationId);
  form.set("expires_at",String(Math.floor(Date.now()/1000)+1860));
  form.set("adaptive_pricing[enabled]","false");
  form.set("success_url",env.PREVIEW_ORIGIN + "/studio/butik/?checkout=complete&session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url",env.PREVIEW_ORIGIN + "/studio/butik/?checkout=cancelled");
  form.set("shipping_address_collection[allowed_countries][0]","SE");
  form.set("phone_number_collection[enabled]","true");
  // Checkout manual tax rates apply to line items, so paid shipping is a taxed line item.
  if (subtotal < THRESHOLD) {
    const index = input.items.length;
    form.set("line_items["+index+"][price_data][currency]","sek");
    form.set("line_items["+index+"][price_data][unit_amount]",String(rate.fixed_amount.amount));
    form.set("line_items["+index+"][price_data][tax_behavior]","inclusive");
    form.set("line_items["+index+"][price_data][product_data][name]","Standardfrakt Sverige");
    form.set("line_items["+index+"][quantity]","1");
    form.set("line_items["+index+"][tax_rates][0]",PRODUCT_TAX_RATE);
  } else {
    form.set("shipping_options[0][shipping_rate]",SHIPPING.free);
  }
  input.items.forEach((item,index) => {
    form.set("line_items["+index+"][price]",PRODUCTS[item.id]);
    form.set("line_items["+index+"][quantity]",String(item.quantity));
    form.set("line_items["+index+"][tax_rates][0]",PRODUCT_TAX_RATE);
  });
  // Retry with the same idempotency key: an interrupted response must not create a second session.
  // If both attempts fail, keep the reservation for reconciliation; payment may still be possible.
  const options = {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":reservationId},body:form.toString()};
  let session;
  try {
    session = await stripe("checkout/sessions",env,options);
  } catch {
    session = await stripe("checkout/sessions",env,options);
  }
  if (session.livemode || !session.url || new URL(session.url).hostname !== "checkout.stripe.com") throw new Error("Invalid Stripe session");
  return reply({url:session.url, sessionId:session.id},200,origin);
}
async function checkoutStatus(request, env) {
  const origin = request.headers.get("Origin");
  if (!env.PREVIEW_ORIGIN || origin !== env.PREVIEW_ORIGIN || !env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) return reply({error:"Not configured"},403);
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!/^cs_test_[a-zA-Z0-9]+$/.test(sessionId || "")) return reply({error:"Invalid session"},400,origin);
  const session = await stripe("checkout/sessions/" + encodeURIComponent(sessionId),env);
  if (session.livemode || session.id !== sessionId) return reply({error:"Invalid session"},400,origin);
  return reply({paid:session.payment_status === "paid", status:session.status},200,origin);
}
// Test-order notifications. Delivery failures return an error so Stripe can retry;
 // Resend idempotency keys prevent duplicate messages on webhook replay.
async function sendOrderEmails(env, sessionId) {
  if (!env.RESEND_API_KEY || !env.OWNER_EMAIL) throw new Error("Email not configured");
  const session = await stripe("checkout/sessions/" + encodeURIComponent(sessionId), env);
  if (session.livemode || session.payment_status !== "paid") throw new Error("Unpaid test order");
  const email = session.customer_details?.email;
  if (!email) throw new Error("Customer email missing");
  const result = await stripe("checkout/sessions/" + encodeURIComponent(sessionId) + "/line_items?limit=100", env);
  if (result.has_more || !Array.isArray(result.data)) throw new Error("Incomplete order items");
  const money = n => (n / 100).toFixed(2).replace(".", ",") + " kr";
  const lines = result.data.map(item => (item.description || "Produkt") + " × " + item.quantity + " – " + money(item.amount_total)).join("\n");
  const shipping = session.collected_information?.shipping_details || session.shipping_details;
  const address = shipping?.address;
  const destination = [shipping?.name, address?.line1, address?.line2, [address?.postal_code, address?.city].filter(Boolean).join(" "), address?.country].filter(Boolean).join("\n");
  if (!address?.line1 || !address?.postal_code || !address?.city) throw new Error("Shipping address missing");
  const total = money(session.amount_total);
  const send = async (to, kind, subject, body) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {"Authorization":"Bearer " + env.RESEND_API_KEY, "Content-Type":"application/json", "Idempotency-Key":"sweforms-" + kind + "-" + sessionId},
      body: JSON.stringify({from:"SweForms <order@mail.sweforms.se>",to:[to],subject,text:body}),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("Email delivery not accepted");
  };
  await send(env.OWNER_EMAIL, "owner", "TEST: Ny beställning hos SweForms",
    "En testbeställning har betalats. Inga riktiga pengar har dragits.\n\n" + lines + "\nTotalt: " + total + "\n\nÖppna beställningar: https://sweforms-order.kent-poli.workers.dev/");
  await send(email, "customer", "TEST: Din orderbekräftelse från SweForms",
    "Tack för din testbeställning! Inga riktiga pengar har dragits och ingen vara skickas.\n\n" + lines + "\nTotalt: " + total + "\n\nLeveransadress:\n" + destination + "\n\nKontakt: kontakt@sweforms.se");
}

async function verifiedWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return reply({error:"Webhook not configured"},503);
  const header=request.headers.get("stripe-signature") || "", parts=header.split(",").map(v=>v.split("="));
  const timestamp=parts.find(([k])=>k==="t")?.[1], signatures=parts.filter(([k])=>k==="v1").map(([,v])=>v);
  if (!/^[0-9]+$/.test(timestamp || "") || Math.abs(Date.now()/1000-Number(timestamp))>300 || !signatures.length) return reply({error:"Invalid signature"},400);
  const body=await request.text();
  if (body.length>1000000) return reply({error:"Too large"},413);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  let ok=false;
  for (const signature of signatures) {
    if (!/^[a-f0-9]{64}$/i.test(signature)) continue;
    const bytes=Uint8Array.from(signature.match(/../g).map(h=>parseInt(h,16)));
    if (await crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(timestamp+"."+body))) ok=true;
  }
  if (!ok) return reply({error:"Invalid signature"},400);
  const event=JSON.parse(body);
  if (event.livemode) return reply({error:"Live events disabled"},400);
  const reservationId = event.data?.object?.metadata?.reservation_id;
  if (reservationId && /^[0-9a-f-]{36}$/.test(reservationId)) {
    if (!env.STOCK_DB) return reply({error:"Stock unavailable"},503);
    if (["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type) && event.data.object.payment_status === "paid") {
      await settleStock(env.STOCK_DB,reservationId,true,event.data.object);
      await sendOrderEmails(env,event.data.object.id);
    } else if (["checkout.session.expired","checkout.session.async_payment_failed"].includes(event.type)) {
      await settleStock(env.STOCK_DB,reservationId,false);
    }
  }
  if (["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type) && event.data?.object?.payment_status === "paid") {
    // Stripe is the order record. No fulfillment or customer details are written to logs.
    console.log("Verified paid checkout",event.id,event.data.object.id);
  }
  return reply({received:true},200);
}
export default { async fetch(request,env) {
  const url=new URL(request.url), origin=request.headers.get("Origin");
  if (request.method==="OPTIONS" && url.pathname==="/checkout" && origin===env.PREVIEW_ORIGIN)
    return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"}});
  try {
    if (request.method==="GET" && url.pathname==="/lagersaldo.json") return await availableStock(request,env);
    if (request.method==="POST" && url.pathname==="/checkout") return await checkout(request,env);
    if (request.method==="GET" && url.pathname==="/checkout-status") return await checkoutStatus(request,env);
    if (request.method==="POST" && url.pathname==="/webhook") return await verifiedWebhook(request,env);
    return reply({error:"Not found"},404);
  } catch { return reply({error:"Något gick fel. Försök igen."},500,origin===env.PREVIEW_ORIGIN?origin:null); }
}};

