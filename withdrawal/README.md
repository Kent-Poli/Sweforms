# Ångerfunktion – utkast för SweForms

Separat Cloudflare Worker, utan ändringar i befintlig checkout, lager eller orderadministration. Funktionen tar emot ångeranmälningar, sparar dem i D1, visar mottagningsbevis och skickar beviset samt en ägaravisering via Resend. Den initierar inte automatiska återbetalningar.

## Innan driftsättning

- Skapa en separat D1-databas, applicera schema.sql och bind den som DB.
- Konfigurera Cloudflare Turnstile för sweforms.se; sätt TURNSTILE_SITE_KEY och TURNSTILE_SECRET_KEY.
- Konfigurera PUBLIC_ORIGIN=https://sweforms.se, FROM_EMAIL (verifierad avsändare), OWNER_EMAIL och RESEND_API_KEY som hemligheter/variabler. Lägg inga hemligheter i GitHub.
- Konfigurera Worker-route sweforms.se/studio/angra-kop* och schemalagd retry var femte minut. Bekräfta att domänen går genom Cloudflare och att rutten inte påverkar andra funktioner.
- Prova i isolerad miljö: korrekt formulär, ogiltiga uppgifter, Turnstile, dubbelsändning, D1-fel, e-postfel och återförsök. Kontrollera faktisk leverans till ägare och kund. Granska säkerhet och missbruksskydd, åtkomst till D1, övervakning av fel och gallring. Verifiera utformningen mot 2 kap. 10 a § distansavtalslagen.
- När allt fungerar: länka tydligt till /studio/angra-kop/ i butikens sidfot, på köpvillkor och kundservice, samt i orderbekräftelser. Uppdatera integritetspolicy för ångeranmälningar. Kontrollera att köparen får villkor och standardblankett i varaktig form.

Inga produktionslänkar publiceras innan mottagningsbeviset är verifierat. Kundens möjlighet att ångra sig via mejl eller telefon måste finnas kvar. D1 lagrar personuppgifter; konfigurera behörighet och gallring innan drift. Koden är ett utkast och ännu inte körtestad.
