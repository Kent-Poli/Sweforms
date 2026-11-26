// Separate public withdrawal Worker. Deploy only after configuration and tests.
const route="/studio/angra-kop/";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const page=(title,content,status=200)=>new Response(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | SweForms</title><style>*{box-sizing:border-box}body{background:#f7f5ef;color:#343a35;font:16px/1.6 system-ui,sans-serif;margin:0}main{max-width:680px;margin:auto;padding:32px 20px}h1{line-height:1.2}label{display:block;font-weight:600;margin-top:15px}input:not([type=checkbox]),textarea{display:block;width:100%;font:inherit;padding:10px;border:1px solid #777;background:white;border-radius:4px}button{font:inherit;font-weight:600;color:white;background:#344d40;border:0;padding:13px 18px;margin-top:18px;border-radius:4px;cursor:pointer}a{color:#344d40}pre{white-space:pre-wrap;font:inherit;background:#fff;padding:15px;overflow-wrap:anywhere}.small{font-size:14px}</style><main><a href="/studio/butik/">SweForms Studio - tillbaka till butiken</a><h1>${esc(title)}</h1>${content}<p class="small"><a href="/studio/integritet/">Integritetspolicy</a> � <a href="/studio/kopvillkor/">K�pvillkor</a></p></main></html>`,{status,headers});
const contact='<p>Du kan ocks� �ngra ditt k�p genom att mejla <a href="mailto:kontakt@sweforms.se">kontakt@sweforms.se</a> eller ringa <a href="tel:+46738224040">073-822 40 40</a>. Du beh�ver inte ange n�got sk�l.</p>';
function form(env,values={},error=""){
  const v=k=>esc(values[k]||"");
  return page("�ngra ditt k�p",`<p>H�r kan du meddela oss att du vill �ngra en best�llning. Det kostar inget att skicka meddelandet. Du f�r ett mottagningsbevis via e-post.</p>${error?'<p role="alert">'+esc(error)+'</p>':""}<form method="post" action="${route}"><label for="name">Ditt namn</label><input id="name" name="name" maxlength="160" required autocomplete="name" value="${v("name")}"><label for="email">E-post f�r mottagningsbevis</label><input id="email" name="email" type="email" maxlength="254" required autocomplete="email" value="${v("email")}"><label for="order">Ordernummer eller annan uppgift som identifierar k�pet</label><input id="order" name="order" maxlength="250" required value="${v("order")}"><label for="items">Vilka varor vill du �ngra?</label><textarea id="items" name="items" rows="4" maxlength="2000" required>${v("items")}</textarea><label><input type="checkbox" name="confirm" value="yes" required> Jag vill �ngra k�pet av varorna ovan och vill f� mottagningsbeviset till angiven e-postadress.</label><input type="hidden" name="request_id" value="${crypto.randomUUID()}"><div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITE_KEY)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><button type="submit">Bekr�fta att jag vill �ngra k�pet</button></form>${contact}`,error?400:200);
}
function receipt(row){return ["SweForms - mottagningsbevis f�r �ngrat k�p","Referens: "+row.id,"Mottaget: "+new Date(row.received_at).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm"})+" (svensk tid)","Namn: "+row.name,"K�p: "+row.order_ref,"Varor: "+row.items,"Vi har tagit emot ditt meddelande om att du vill �ngra k�pet. Detta �r ett mottagningsbevis, inte en bekr�ftelse p� �terbetalning.","Fr�gor: kontakt@sweforms.se"].join("\n");}
async function readLimited(request, limit) {
  const size = request.headers.get("Content-Length");
  if (size && (!/^\d+$/.test(size) || Number(size) > limit)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = "";
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) { await reader.cancel(); return null; }
    text += decoder.decode(value, {stream:true});
  }
  return text + decoder.decode();
}
async function send(env,row,kind){
  const recipient=kind==="customer"?row.email:env.OWNER_EMAIL;
  const content=receipt(row)+(kind==="owner"?"\nKundens e-post: "+row.email:"");
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"withdrawal-"+row.id+"-"+kind},body:JSON.stringify({from:env.FROM_EMAIL,to:[recipient],subject:kind==="customer"?"Mottagningsbevis - SweForms":"Ny �ngeranm�lan - SweForms",text:content,reply_to:"kontakt@sweforms.se"})});
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
  if(!ready(env))return page("�ngerfunktionen �r tillf�lligt otillg�nglig",contact,503);
  if(request.method==="GET")return form(env);
  if(request.method!=="POST")return new Response("Method not allowed",{status:405,headers:{Allow:"GET, POST"}});
  if(request.headers.get("Origin")!==env.PUBLIC_ORIGIN)return page("Beg�ran kunde inte skickas",contact,403);
  if(!request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded"))return page("Beg�ran kunde inte skickas",contact,415);
  const raw=await readLimited(request,18000);
  if(raw===null)return page("Meddelandet �r f�r l�ngt",contact,413);
  const data=new URLSearchParams(raw);const values=Object.fromEntries(["name","email","order","items"].map(k=>[k,(data.get(k)||"").trim()]));
  const {name,email,order,items}=values;
  if(!name||name.length>160||!email||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||!order||order.length>250||!items||items.length>2000||data.get("confirm")!=="yes")return form(env,values,"Kontrollera att alla uppgifter �r ifyllda och bekr�fta att du vill �ngra k�pet.");
  try{
   const t=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:data.get("cf-turnstile-response")||""})});
   const verified=await t.json();
   if(!verified.success||verified.hostname!==new URL(env.PUBLIC_ORIGIN).hostname)return form(env,values,"S�kerhetskontrollen misslyckades. F�rs�k igen eller kontakta oss direkt.");
   const id=data.get("request_id");
   if(!/^[a-f0-9-]{36}$/i.test(id||""))return form(env,values,"Ladda om sidan och f�rs�k igen.");
   const received_at=new Date().toISOString();
   const row={id,name,email,order_ref:order,items,received_at,customer_sent:0,owner_sent:0};
   const inserted=await env.DB.prepare("INSERT OR IGNORE INTO withdrawals (id,name,email,order_ref,items,received_at) VALUES (?,?,?,?,?,?)").bind(id,name,email,order,items,received_at).run();
   if(!inserted.meta.changes)return page("Meddelandet har redan registrerats","<p>Kontrollera din e-post eller kontakta oss om du saknar mottagningsbevis.</p>"+contact);
   const outcomes=await notify(env,row);
   const accepted=outcomes[0].status==="fulfilled";
   return page("Vi har tagit emot ditt meddelande",`<p>${accepted?"Mottagningsbeviset har l�mnats till v�r e-posttj�nst.":"Meddelandet �r sparat men e-postutskicket har �nnu inte bekr�ftats. Vi f�rs�ker igen automatiskt."} Spara g�rna informationen nedan.</p><pre>${esc(receipt(row))}</pre>${contact}`);
  }catch{return page("Vi kunde inte bekr�fta din anm�lan","<p>Kontakta oss direkt s� att vi kan kontrollera att ditt meddelande har kommit fram.</p>"+contact,503);}
 },
 async scheduled(event,env){if(!ready(env))return;const {results}=await env.DB.prepare("SELECT * FROM withdrawals WHERE (customer_sent=0 OR owner_sent=0) ORDER BY received_at LIMIT 25").all();for(const row of results)await notify(env,row);}
};


