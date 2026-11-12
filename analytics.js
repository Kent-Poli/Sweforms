/* SweForms Web Analytics
 * Lägg in Cloudflare Web Analytics site token nedan för att aktivera mätning.
 * Token är publik och hör till just sweforms.se.
 * Ingen spårning startar innan en giltig token är angiven.
 */
(() => {
  'use strict';
  const cloudflareSiteToken = '3a1df16475bf4bb6bf7a0a8dfc5a1f2f';
  if (!/^[a-f0-9]{32}$/i.test(cloudflareSiteToken)) return;

  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: cloudflareSiteToken }));
  document.head.appendChild(beacon);
})();
