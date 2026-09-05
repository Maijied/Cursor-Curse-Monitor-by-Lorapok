/**
 * Cloudflare Web Analytics (beacon) for Lorapok marketing + Mission Control shells.
 * Token is public (client-side); configured in Cloudflare dashboard.
 */
(function () {
  if (document.querySelector('script[data-cf-beacon]')) return;
  const script = document.createElement("script");
  script.type = "module";
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", '{"token": "6edbc549bb8d4ac0a70d9e380c826c28"}');
  document.head.appendChild(script);
})();
