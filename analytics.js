/* RIVERO — Analítica (Google Analytics 4) + eventos de negocio.
   1) Pegá tu Measurement ID en GA_ID (formato G-XXXXXXXXXX).
   2) Mientras sea el placeholder, no carga GA (no rompe nada); al ponerlo, se activa.
   Eventos que registra automáticamente (por delegación de clicks):
   - whatsapp_flag_click (country, lang)   → clic en una bandera → WhatsApp
   - become_a_buyer_click (lang)           → CTA "Conviértete en comprador"
   - open_full_catalog (lang)              → abrir catálogo completo
   - open_category (page, lang)            → abrir una categoría
   - email_click (lang)                    → clic en el email
   - change_language (to)                  → cambio de idioma
   Además envía page_view (nativo de GA4). */
(function () {
  if (window.__RV_ANALYTICS__) return; // evita doble init (la página re-hidrata)
  window.__RV_ANALYTICS__ = true;

  var GA_ID = 'G-XXXXXXXXXX'; // <-- REEMPLAZAR con el Measurement ID real

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  window.RV_track = function (name, params) { try { gtag('event', name, params || {}); } catch (e) {} };

  var valid = GA_ID && GA_ID.charAt(0) === 'G' && GA_ID !== 'G-XXXXXXXXXX';
  if (valid) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  var lang = function () { return window.RV_LANG || 'es'; };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.classList.contains('rv-flag-link') || /wa\.me/i.test(href)) {
      var img = a.querySelector && a.querySelector('img');
      var country = a.getAttribute('title') || (img && img.getAttribute('alt')) || '';
      window.RV_track('whatsapp_flag_click', { country: country, lang: lang(), link_url: href });
    } else if (/become-a-buyer/i.test(href)) {
      window.RV_track('become_a_buyer_click', { lang: lang(), link_url: href });
    } else if (/^mailto:/i.test(href)) {
      window.RV_track('email_click', { lang: lang() });
    } else if (/^\?lang=/i.test(href)) {
      window.RV_track('change_language', { to: href.replace(/^\?lang=/i, '') });
    } else if (/completo\.html/i.test(href)) {
      window.RV_track('open_full_catalog', { lang: lang() });
    } else if (/\.html(\?|#|$)/i.test(href) && !/^https?:/i.test(href)) {
      window.RV_track('open_category', { page: href.split('?')[0].split('#')[0], lang: lang() });
    }
  }, true);
})();
