// Separate public withdrawal Worker. Deploy only after configuration and tests.
const route="/studio/angra-kop/";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const page=(title,content,status=200)=>new Response(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | SweForms</title><style>*{box-sizing:border-box}body{background:#f7f5ef;color:#343a35;font:16px/1.6 system-ui,sans-serif;margin:0}main{max-width:680px;margin:auto;padding:32px 20px}h1{line-height:1.2}label{display:block;font-weight:600;margin-top:15px}input:not([type=checkbox]),textarea{display:block;width:100%;font:inherit;padding:10px;border:1px solid #777;background:white;border-radius:4px}button{font:inherit;font-weight:600;color:white;background:#344d40;border:0;padding:13px 18px;margin-top:18px;border-radius:4px;cursor:pointer}a{color:#344d40}pre{white-space:pre-wrap;font:inherit;background:#fff;padding:15px;overflow-wrap:anywhere}.small{font-size:14px}</style><main><a href="/studio/butik/">SweForms Studio – tillbaka till butiken</a><h1>${esc(title)}</h1>${content}<p class="small"><a href="/studio/integritet/">Integritetspolicy</a> · <a href="/studio/kopvillkor/">Köpvillkor</a></p></main></html>`,{status,headers});
const contact='<p>Du kan också ångra ditt köp genom att mejla <a href="mailto:kontakt@sweforms.se">kontakt@sweforms.se</a> eller ringa <a href="tel:+46738224040">073-822 40 40</a>. Du behöver inte ange något skäl.</p>';
function form(env,values={},error=""){
  const v=k=>esc(values[k]||"");
  return page("Ångra ditt köp",`<p>Här kan du meddela oss att du vill ångra en beställning. Det kostar inget att skicka meddelandet. Du får ett mottagningsbevis via e-post.</p>${error?'<p role="alert">'+esc(error)+'</p>':""}<form method="post" action="${route}"><label for="name">Ditt namn</label><input id="name" name="name" maxlength="160" required autocomplete="name" value="${v("name")}"><label for="email">E-post för mottagningsbevis</label><input id="email" name="email" type="email" maxlength="254" required autocomplete="email" value="${v("email")}"><label for="order">Ordernummer eller annan uppgift som identifierar köpet</label><input id="order" name="order" maxlength="250" required value="${v("order")}"><label for="items">Vilka varor vill du ångra?</label><textarea id="items" name="items" rows="4" maxlength="2000" required>${v("items")}</textarea><label><input type="checkbox" name="confirm" value="yes" required> Jag vill ångra köpet av varorna ovan och vill få mottagningsbeviset till angiven e-postadress.</label><input type="hidden" name="request_id" value="${crypto.randomUUID()}"><div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITE_KEY)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><button type="submit">Bekräfta att jag vill ångra köpet</button></form>${contact}`,error?400:200);
}
function receipt(row){return ["SweForms – mottagningsbevis för ångrat köp","Referens: "+row.id,"Mottaget: "+new Date(row.received_at).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm"})+" (svensk tid)","Namn: "+row.name,"Köp: "+row.order_ref,"Varor: "+row.items,"Vi har tagit emot ditt meddelande om att du vill ångra köpet. Detta är ett mottagningsbevis, inte en bekräftelse på återbetalning.","Frågor: kontakt@sweforms.se"].join("\n");}
async function send(env,row,kind){
  const recipient=kind==="customer"?row.email:env.OWNER_EMAIL;
  const content=receipt(row)+(kind==="owner"?"\nKundens e-post: "+row.email:"");
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"withdrawal-"+row.id+"-"+kind},body:JSON.stringify({from:env.FROM_EMAIL,to:[recipient],subject:kind==="customer"?"Mottagningsbevis – SweForms":"Ny ångeranmälan – SweForms",text:content,reply_to:"kontakt@sweforms.se"})});
  if(!res.ok)throw Error("Email not accepted");
  const field=kind==="customer"?"customer_sent":"owner_sent";
  await env.DB.prepare("UPDATE withdrawals SET "+field+"=1 WHERE id=?").bind(row.id).run();
}
async function notify(env,row){return Promise.allSettled([row.customer_sent?Promise.resolve():send(env,row,"customer"),row.owner_sent?Promise.resolve():send(env,row,"owner")]);}
function ready(env){return env.DB&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&env.RESEND_API_KEY&&env.FROM_EMAIL&&env.OWNER_EMAIL&&env.PUBLIC_ORIGIN;}
export default {
 async fetch(request,env){
  const u=new URL(request.url);
  if(u.pathname!==route&&u.pathname!==route.slice(0,-1))return new Response("Not found",{status:404});
  if(!ready(env))return page("Ångerfunktionen är tillfälligt otillgänglig",contact,503);
  if(request.method==="GET")return form(env);
  if(request.method!=="POST")return new Response("Method not allowed",{status:405,headers:{Allow:"GET, POST"}});
  if(request.headers.get("Origin")!==env.PUBLIC_ORIGIN)return page("Begäran kunde inte skickas",contact,403);
  if(!request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded"))return page("Begäran kunde inte skickas",contact,415);
  const raw=await request.text();
  if(raw.length>18000)return page("Meddelandet är för långt",contact,413);
  const data=new URLSearchParams(raw);const values=Object.fromEntries(["name","email","order","items"].map(k=>[k,(data.get(k)||"").trim()]));
  const {name,email,order,items}=values;
  if(!name||name.length>160||!email||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||!order||order.length>250||!items||items.length>2000||data.get("confirm")!=="yes")return form(env,values,"Kontrollera att alla uppgifter är ifyllda och bekräfta att du vill ångra köpet.");
  try{
   const t=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:data.get("cf-turnstile-response")||""})});
   const verified=await t.json();
   if(!verified.success||verified.hostname!==new URL(env.PUBLIC_ORIGIN).hostname)return form(env,values,"Säkerhetskontrollen misslyckades. Försök igen eller kontakta oss direkt.");
   const id=data.get("request_id");
   if(!/^[a-f0-9-]{36}$/i.test(id||""))return form(env,values,"Ladda om sidan och försök igen.");
   const received_at=new Date().toISOString();
   const row={id,name,email,order_ref:order,items,received_at,customer_sent:0,owner_sent:0};
   const inserted=await env.DB.prepare("INSERT OR IGNORE INTO withdrawals (id,name,email,order_ref,items,received_at) VALUES (?,?,?,?,?,?)").bind(id,name,email,order,items,received_at).run();
   if(!inserted.meta.changes)return page("Meddelandet har redan registrerats","<p>Kontrollera din e-post eller kontakta oss om du saknar mottagningsbevis.</p>"+contact);
   const outcomes=await notify(env,row);
   const accepted=outcomes[0].status==="fulfilled";
   return page("Vi har tagit emot ditt meddelande",`<p>${accepted?"Mottagningsbeviset har lämnats till vår e-posttjänst.":"Meddelandet är sparat men e-postutskicket har ännu inte bekräftats. Vi försöker igen automatiskt."} Spara gärna informationen nedan.</p><pre>${esc(receipt(row))}</pre>${contact}`);
  }catch{return page("Vi kunde inte bekräfta din anmälan","<p>Kontakta oss direkt så att vi kan kontrollera att ditt meddelande har kommit fram.</p>"+contact,503);}
 },
 async scheduled(event,env){if(!ready(env))return;const {results}=await env.DB.prepare("SELECT * FROM withdrawals WHERE (customer_sent=0 OR owner_sent=0) ORDER BY received_at LIMIT 25").all();for(const row of results)await notify(env,row);}
};
