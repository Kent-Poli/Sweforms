import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "./checkout-live-worker.mjs";

Object.defineProperty(globalThis, "crypto", {value:webcrypto, configurable:true});
const sent = new Set();
let requests = [];
let failCustomer = false;
const db = {
  prepare(sql) {
    return { bind(...args) {
      return {
        sql, args,
        async first() {
          if (sql.includes("email_deliveries")) return sent.has(args.join(":")) ? {sent: 1} : null;
          if (sql.includes("JOIN reservations")) return {ok: 1};
          throw new Error("Unexpected first: " + sql);
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO email_deliveries")) sent.add(args.join(":"));
          return {meta:{changes:1}};
        }
      };
    }};
  },
  async batch() {}
};
const sessionId = "cs_live_ABC123", reservationId = "12345678-1234-1234-1234-123456789abc";
const session = { id:sessionId, livemode:true, payment_status:"paid", amount_total:52800,
  payment_intent:"pi_ABC123", customer_details:{email:"customer@example.org"},
  metadata:{reservation_id:reservationId} };
globalThis.fetch = async (url, options) => {
  if (url.endsWith("/line_items?limit=100")) return Response.json({has_more:false,data:[{description:"Sommaräng",quantity:1,amount_total:44900}]});
  if (url.includes("api.stripe.com")) return Response.json(session);
  if (url === "https://api.resend.com/emails") {
    const message = JSON.parse(options.body);
    requests.push(message);
    if (failCustomer && message.to[0] === "customer@example.org") return new Response("error", {status:503});
    return Response.json({id:"email-id"});
  }
  throw new Error("Unexpected URL");
};
const env = {STRIPE_SECRET_KEY:"sk_live_example", STRIPE_WEBHOOK_SECRET:"secret", RESEND_API_KEY:"test", OWNER_EMAIL:"owner@example.org", STOCK_DB:db};
const disabled = await worker.fetch(new Request("https://worker.example/checkout", {
  method:"POST", headers:{"Origin":"https://sweforms.se","Content-Type":"application/json"},
  body:JSON.stringify({items:[{id:"sommarang",quantity:1}]})
}), {...env, PREVIEW_ORIGIN:"https://sweforms.se"});
assert.equal(disabled.status,503);
assert.equal(requests.length,0);
async function webhook(object, type="checkout.session.completed", valid=true) {
  const body=JSON.stringify({livemode:true,type,data:{object}});
  const timestamp=Math.floor(Date.now()/1000).toString();
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode("secret"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=Buffer.from(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+body))).toString("hex");
  return worker.fetch(new Request("https://worker.example/webhook",{method:"POST",body,headers:{"stripe-signature":"t="+timestamp+",v1="+(valid?sig:"0".repeat(64))}}),env);
}
assert.equal((await webhook(session,"checkout.session.completed",false)).status,400);
assert.equal(requests.length,0);
assert.equal((await webhook({...session,metadata:{}})).status,500);
assert.equal(requests.length,0);
assert.equal((await webhook(session)).status,200);
assert.equal(requests.length,2);
assert.deepEqual(requests.map(x=>x.to[0]),["customer@example.org","owner@example.org"]);
assert.equal((await webhook(session)).status,200);
assert.equal(requests.length,2);
sent.clear(); requests=[]; failCustomer=true;
assert.equal((await webhook(session)).status,500);
assert.equal(requests.length,2);
assert.equal(sent.has(sessionId+":owner"),true);
assert.equal(sent.has(sessionId+":customer"),false);
failCustomer=false;
assert.equal((await webhook(session)).status,200);
assert.equal(requests.length,3);
assert.equal(requests[2].to[0],"customer@example.org");
console.log("Webhook signature, reservation, independent emails and retries: OK");
