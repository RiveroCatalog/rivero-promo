/* RIVERO — Analítica (Google Analytics 4) + eventos + consentimiento de cookies.
   GA NO se carga hasta que el visitante acepta el banner de cookies.
   Eventos (por delegación de clicks, se envían solo si hay consentimiento):
   - whatsapp_flag_click (country, lang), become_a_buyer_click (lang),
     open_full_catalog (lang), open_category (page, lang), email_click (lang),
     change_language (to). Más page_view (nativo de GA4). */
(function () {
  if (window.__RV_ANALYTICS__) return; // evita doble init (la página re-hidrata)
  window.__RV_ANALYTICS__ = true;

  var GA_ID = 'G-WHWTHDPS3T'; // Measurement ID de Rivero Catálogo

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  window.RV_track = function (name, params) { try { gtag('event', name, params || {}); } catch (e) {} };

  var gaStarted = false;
  function initGA() {
    if (gaStarted) return;
    gaStarted = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  /* ---------- Consentimiento de cookies ---------- */
  var consent = null;
  try { consent = localStorage.getItem('rv_consent'); } catch (e) {}
  if (consent === 'granted') initGA();
  else if (consent !== 'denied') mountBannerWhenReady();

  function setConsent(v) {
    try { localStorage.setItem('rv_consent', v); } catch (e) {}
    var b = document.getElementById('rv-consent');
    if (b) b.remove();
    if (v === 'granted') initGA();
  }

  function texts() {
    var en = (window.RV_LANG === 'en');
    return en
      ? { msg: 'We use cookies to measure site traffic and improve your experience.', acc: 'Accept', rej: 'Reject' }
      : { msg: 'Usamos cookies para medir el tráfico del sitio y mejorar tu experiencia.', acc: 'Aceptar', rej: 'Rechazar' };
  }

  function mountBanner() {
    if (document.getElementById('rv-consent')) return;
    var t = texts();
    var d = document.createElement('div');
    d.id = 'rv-consent';
    d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:540px;margin:0 auto;z-index:2147483601;background:#fff;color:#26282c;border:1px solid rgba(0,0,0,.1);border-radius:14px;box-shadow:0 12px 44px rgba(0,0,0,.32);padding:16px 18px;font-family:Jost,system-ui,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:12px';
    var p = document.createElement('span');
    p.textContent = t.msg;
    p.style.cssText = 'flex:1;min-width:210px;font-size:14px;line-height:1.45';
    var rej = document.createElement('button');
    rej.textContent = t.rej;
    rej.style.cssText = 'cursor:pointer;border:1px solid rgba(0,0,0,.16);border-radius:999px;padding:9px 16px;font:inherit;font-size:14px;font-weight:600;background:transparent;color:#565a62';
    var acc = document.createElement('button');
    acc.textContent = t.acc;
    acc.style.cssText = 'cursor:pointer;border:0;border-radius:999px;padding:9px 20px;font:inherit;font-size:14px;font-weight:700;background:#235CF2;color:#fff';
    rej.onclick = function () { setConsent('denied'); };
    acc.onclick = function () { setConsent('granted'); };
    d.appendChild(p);
    d.appendChild(rej);
    d.appendChild(acc);
    document.body.appendChild(d);
  }
  function mountBannerWhenReady() {
    if (document.readyState !== 'loading') mountBanner();
    else document.addEventListener('DOMContentLoaded', mountBanner);
  }

  /* ---------- Eventos de negocio (delegación de clicks) ---------- */
  var lang = function () { return window.RV_LANG || 'es'; };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.classList.contains('rv-availability-link')) {
      window.RV_track('availability_check_click', { sku: a.getAttribute('data-sku') || '', category: a.getAttribute('data-cat') || '', lang: lang() });
    } else if (a.classList.contains('rv-flag-link') || /wa\.me/i.test(href)) {
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
