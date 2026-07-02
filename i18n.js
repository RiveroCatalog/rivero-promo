/* RIVERO — capa de internacionalización (ES / EN).
   - Resuelve el idioma desde ?lang=, localStorage o 'es' por defecto.
   - Expone window.RV_LANG, window.RV_setLang(l), window.RV_I18N (categorías + textos UI).
   - Inyecta un selector de idioma fijo arriba-izquierda en las páginas de deck. */
(function () {
  var q = null;
  try { q = new URL(location.href).searchParams.get('lang'); } catch (e) {}
  var stored = null;
  try { stored = localStorage.getItem('rv_lang'); } catch (e) {}
  var lang = (q === 'en' || q === 'es') ? q : ((stored === 'en' || stored === 'es') ? stored : 'es');
  try { localStorage.setItem('rv_lang', lang); } catch (e) {}
  window.RV_LANG = lang;

  window.RV_setLang = function (l) {
    if (l !== 'en' && l !== 'es') return;
    try { localStorage.setItem('rv_lang', l); } catch (e) {}
    var u;
    try { u = new URL(location.href); u.searchParams.set('lang', l); location.href = u.toString(); }
    catch (e) { location.search = '?lang=' + l; }
  };

  window.RV_I18N = {
    numLocale: { es: 'es-AR', en: 'en-US' },
    catEN: {
      'Muebles & hogar': 'Furniture & Home',
      'Iluminación': 'Lighting',
      'Cocina': 'Kitchen',
      'Baño': 'Bathroom',
      'Climatización': 'Climate Control',
      'Organización & closet': 'Organization & Closet',
      'Cortinas & ventanas': 'Curtains & Windows',
      'Jardín & exterior': 'Garden & Outdoor',
      'Equipos de jardín': 'Lawn & Garden Equipment',
      'Herramientas & taller': 'Tools & Workshop',
      'Ferretería & construcción': 'Hardware & Construction',
      'Plomería & electricidad': 'Plumbing & Electrical',
    },
    ui: {
      es: {
        /* deck */
        stockAvailable: 'Stock disponible',
        consult: 'Consultar disponibilidad',
        unitsInStock: ' unidades en stock',
        uShort: 'u.',
        onRequest: 'A consultar',
        lotValue: 'Valor del lote',
        availableChip: 'Disponible',
        skusInCat: 'SKUs en la categoría',
        units: 'Unidades',
        lotValueShort: 'Valor de lote',
        skusAvailable: 'SKUs disponibles',
        categories: 'Categorías',
        categoriesLower: 'categorías',
        totalUnits: 'Unidades totales',
        inventoryValue: 'Valor de inventario',
        lotByCategory: 'El lote por categoría',
        category: 'Categoría',
        skus: 'SKUs',
        email: 'Email',
        whatsapp: 'WhatsApp',
        /* index */
        idxHeroEyebrow: 'Catálogo mayorista · Julio 2026',
        idxHeroTitle: 'Convertimos el exceso en oportunidad',
        idxHeroSub: 'Surtido consolidado de retail norteamericano, listo para contenedor: mobiliario, iluminación, cocina, baño, climatización, herramientas y jardín de marcas líderes — desde el depósito de Miami. Precios mayoristas USD; medidas en sistema métrico.',
        idxCtaFull: 'Ver catálogo completo',
        idxCtaBuyer: 'Quiero recibir más Información',
        idxStatValue: 'Valor USD',
        idxFullEyebrow: 'Catálogo completo',
        idxFullTitle: 'Todo el inventario en un documento',
        idxExplore: 'Explorá por categoría',
        valueUsd: 'Valor USD',
        footerEyebrow: 'Próximos pasos',
        footerTitle: 'Contacta con tu representante',
      },
      en: {
        /* deck */
        stockAvailable: 'Available stock',
        consult: 'Contact for availability',
        unitsInStock: ' units in stock',
        uShort: 'u.',
        onRequest: 'On request',
        lotValue: 'Lot value',
        availableChip: 'Available',
        skusInCat: 'SKUs in category',
        units: 'Units',
        lotValueShort: 'Lot value',
        skusAvailable: 'Available SKUs',
        categories: 'Categories',
        categoriesLower: 'categories',
        totalUnits: 'Total units',
        inventoryValue: 'Inventory value',
        lotByCategory: 'The lot by category',
        category: 'Category',
        skus: 'SKUs',
        email: 'Email',
        whatsapp: 'WhatsApp',
        /* index */
        idxHeroEyebrow: 'Wholesale catalog · July 2026',
        idxHeroTitle: 'We turn excess into opportunity',
        idxHeroSub: 'Consolidated North American retail assortment, container-ready: furniture, lighting, kitchen, bath, climate control, tools and garden from leading brands — from our Miami warehouse. Wholesale prices USD; imperial measurements.',
        idxCtaFull: 'View full catalog',
        idxCtaBuyer: 'Get more Information',
        idxStatValue: 'Value USD',
        idxFullEyebrow: 'Full catalog',
        idxFullTitle: 'All inventory in one document',
        idxExplore: 'Browse by category',
        valueUsd: 'Value USD',
        footerEyebrow: 'Next steps',
        footerTitle: 'Contact your representative',
      },
    },
  };

  /* Selector de idioma flotante (solo en páginas de deck; el índice lo monta en su header) */
  function mountToggle() {
    if (document.getElementById('rv-lang-toggle')) return;
    if (!document.querySelector('deck-stage')) return; /* index monta el suyo */
    var box = document.createElement('div');
    box.id = 'rv-lang-toggle';
    box.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483600;display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 2px 12px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.08);font-family:Jost,system-ui,sans-serif';
    ['es', 'en'].forEach(function (l) {
      var b = document.createElement('button');
      b.textContent = l.toUpperCase();
      var on = (l === lang);
      b.style.cssText = 'cursor:pointer;border:0;border-radius:999px;padding:5px 12px;font:inherit;font-size:12px;font-weight:700;letter-spacing:.08em;' + (on ? 'background:#235CF2;color:#fff;' : 'background:transparent;color:#565a62;');
      b.onclick = function () { if (l !== lang) window.RV_setLang(l); };
      box.appendChild(b);
    });
    document.body.appendChild(box);
  }
  if (document.readyState !== 'loading') mountToggle();
  else document.addEventListener('DOMContentLoaded', mountToggle);
})();
