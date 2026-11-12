/* SweForms Web Analytics
 * Lägg in Cloudflare Web Analytics site token nedan för att aktivera mätning.
 * Token är publik och hör till just sweforms.se.
 * Ingen spårning startar innan en giltig token är angiven.
 */
(() => {
  'use strict';
  const cloudflareSiteToken = '';
  if (!/^[a-f0-9]{32}$/i.test(cloudflareSiteToken)) return;

  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js?token=' + cloudflareSiteToken;
  document.head.appendChild(beacon);
})();
