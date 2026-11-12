# Trafikmätning för sweforms.se

## Cloudflare Web Analytics
1. Logga in på https://dash.cloudflare.com/ och gå till **Web Analytics**.
2. Välj **Add a site** och registrera hostname `sweforms.se`.
3. Öppna **Manage site** och kopiera site token från Cloudflares JavaScript-snippet (32 hex-tecken).
4. Ersätt den tomma strängen `cloudflareSiteToken = ''` i `/analytics.js` med token.
5. Webbplatsens offentliga HTML-sidor laddar `/analytics.js`. Mätning startar först när token finns på plats. Kontrollera i Cloudflare Web Analytics att ett sidbesök registreras.

## Google Search Console
1. Öppna https://search.google.com/search-console/ med Google-kontot som ska äga webbplatsen.
2. Lägg till egenskapen **URL-prefix** `https://sweforms.se/`.
3. Välj **HTML file upload** under verifieringsmetoder och ladda ned Googles unika verifieringsfil.
4. Lägg exakt samma fil i webbplatsens GitHub-repos rot och publicera den. Filnamn och innehåll får inte ändras. Klicka sedan **Verify** i Search Console.
5. Under **Sitemaps**: skicka in `https://sweforms.se/sitemap.xml`. `robots.txt` pekar redan på den.

Google Search Console verifierar ägarskap och visar Google-söktrafik, medan Cloudflare ger webbplatsbesök. Ingen tjänst är aktiverad enbart genom denna förberedelse.

Lämna inte ut kontolösenord, återställningskoder eller hemliga API-nycklar. GSC-verifieringsfilen är avsedd att publiceras.
