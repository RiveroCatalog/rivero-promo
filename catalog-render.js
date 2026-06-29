/* RIVERO — Render compartido del catálogo.
   window.RiveroCatalog.build(stage, { category, showRetail, showSku })
   - Sin category: catálogo completo (portada + índice + todas las categorías + cierre).
   - Con category: documento de una sola categoría (portada de categoría + productos + cierre).
   Reutiliza window.INVENTORY, catalog.css y deck-stage.js. */
(function () {
  const CATS = [
    { name: 'Muebles & hogar',           color: '#B23A48' },
    { name: 'Iluminación',               color: '#E2960F' },
    { name: 'Cocina',                    color: '#235CF2' },
    { name: 'Baño',                      color: '#1593AE' },
    { name: 'Climatización',             color: '#2E5FD0' },
    { name: 'Organización & closet',     color: '#1F9E7A' },
    { name: 'Cortinas & ventanas',       color: '#3E8FD0' },
    { name: 'Jardín & exterior',         color: '#0E9E4A' },
    { name: 'Equipos de jardín',         color: '#FF8001' },
    { name: 'Herramientas & taller',     color: '#565A62' },
    { name: 'Ferretería & construcción', color: '#C2000B' },
    { name: 'Plomería & electricidad',   color: '#6B7785' },
  ];

  const money = (n, d = 0) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const LANG = () => (window.RV_LANG === 'en' ? 'en' : 'es');
  const units = (n) => Number(n).toLocaleString(LANG() === 'en' ? 'en-US' : 'es-AR');
  const compact = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + (LANG() === 'en' ? 'M' : 'MILL') : (n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : money(n)));
  const up = (s) => (s || '').toUpperCase();
  const clean = (s) => (s || '').replace(/"/g, '\u201D');
  const T = (k) => { const d = (window.RV_I18N && window.RV_I18N.ui) || { es: {}, en: {} }; return ((d[LANG()] || d.es || {})[k]) || ((d.es || {})[k]) || ''; };
  const catN = (n) => (LANG() === 'en' && window.RV_I18N && window.RV_I18N.catEN[n]) ? window.RV_I18N.catEN[n] : n;
  const pn = (p) => (LANG() === 'en' ? (p.name_en || p.name) : p.name);
  const mm = (C) => (LANG() === 'en' ? Object.assign({}, C.meta, C.meta_en) : C.meta);
  const ctc = (C) => (LANG() === 'en' ? Object.assign({}, C.contact, C.contact_en) : C.contact);

  function groupAll(C) {
    const known = CATS.map((c) => c.name);
    const groups = CATS.map((c) => ({ ...c, items: C.products.filter((p) => p.cat === c.name) }));
    const extras = {};
    C.products.filter((p) => !known.includes(p.cat)).forEach((p) => {
      (extras[p.cat] = extras[p.cat] || []).push(p);
    });
    Object.keys(extras).forEach((name) => groups.push({ name, color: '#6B7785', items: extras[name] }));
    return groups.filter((g) => g.items.length);
  }

  function makeAdd(stage) {
    return (label, cls, html, style) => {
      const s = document.createElement('section');
      if (cls) s.className = cls;
      if (style) s.setAttribute('style', style);
      s.setAttribute('data-label', label);
      s.innerHTML = html;
      stage.appendChild(s);
    };
  }

  function topbar(C) {
    const M = mm(C);
    return `<header class="rv-topbar">
      <img class="rv-logo" src="assets/rivero-logo-lineal-white.png" alt="Rivero">
      <span class="rv-topbar-meta">${up(M.location)} &nbsp;·&nbsp; ${up(M.terms)}</span>
    </header>`;
  }

  function productSlide(add, C, g, p, idx, tot, opts) {
    const hasPrice = p.price > 0;
    const low = p.qty <= 20;
    const lote = p.price * p.qty;
    const hasDisc = opts.showRetail && p.retail > p.price && p.price > 0;
    const discPct = hasDisc ? Math.round((1 - p.price / p.retail) * 100) : 0;
    const M = mm(C);
    const gname = catN(g.name);
    const nm = pn(p);
    const priceBlock = hasPrice
      ? `<span class="rv-pstat-val rv-accent">${money(p.price, 2)}</span>` +
        (hasDisc ? ` <s class="rv-retail-strike">retail ${money(p.retail, 2)}</s>` : '')
      : `<span class="rv-pstat-val rv-accent" style="font-size:48px">${T('onRequest')}</span>`;
    add(`${idx} · ${nm}`, 'rv-slide rv-product', `
      <div class="rv-prod-media">
        <span class="rv-prod-index">${idx} <em>/ ${tot}</em></span>
        <span class="rv-prod-cat"><i></i>${up(gname)}</span>
        <div class="rv-prod-tile"><img src="${p.img}" alt="${clean(nm)}"></div>
        <span class="rv-stock-dot"><i></i>${low ? T('consult') : units(p.qty) + T('unitsInStock')}</span>
      </div>
      <div class="rv-prod-info">
        <div class="rv-prod-info-top">
          <span class="rv-eyebrow rv-accent">${up(M.eyebrow)} &nbsp;·&nbsp; ${up(gname)}</span>
          ${p.brand ? `<div class="rv-prod-brand">${up(p.brand)}</div>` : ''}
          <h2 class="rv-prod-name">${clean(nm)}</h2>
          ${opts.showSku ? `<div class="rv-prod-sku">SKU ${p.sku}</div>` : ''}
        </div>
        <div class="rv-prod-stats">
          <div class="rv-pstat rv-pstat-price">
            <span class="rv-pstat-lbl">${M.priceLabel} ${M.currency}${hasDisc ? ` <span class="rv-disc-pill">&minus;${discPct}%</span>` : ''}</span>
            <span class="rv-price-line">${priceBlock}</span>
          </div>
          <div class="rv-pstat">
            <span class="rv-pstat-lbl">${T('stockAvailable')}</span>
            ${low ? '<span class="rv-pstat-val" style="font-size:30px">' + T('consult') + '</span>' : '<span class="rv-pstat-val">' + units(p.qty) + ' <small>' + T('uShort') + '</small></span>'}
          </div>
          <div class="rv-pstat">
            <span class="rv-pstat-lbl">${T('lotValue')}</span>
            <span class="rv-pstat-val">${low ? '—' : (hasPrice ? money(lote) : '—')} <small>${(!low && hasPrice) ? M.currency : ''}</small></span>
          </div>
        </div>
        <div class="rv-prod-foot">
          <span class="rv-chip rv-chip-ok"><i></i>${T('availableChip')} · ${M.location}</span>
          <span class="rv-chip">FOB · ${M.currency}</span>
          <img class="rv-prod-logo" src="assets/rivero-logo-lineal.png" alt="Rivero">
        </div>
      </div>
    `, `--cat:${g.color}`);
  }

  function closing(add, C) {
    const ct = ctc(C);
    const flags = (ct.countries || [])
      .map((c) => `<img class="rv-flag" src="assets/flags/${c.code}.svg" alt="${c.name}" title="${c.name}">`)
      .join('');
    const waDigits = (ct.whatsapp || ct.phone || '').replace(/\D/g, '');
    add(ct.eyebrow, 'rv-slide rv-cover rv-closing', `
      <img class="rv-cover-symbol" src="assets/rivero-symbol-white.png" alt="">
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(ct.eyebrow)}</span>
        <h1 class="rv-cover-title rv-closing-title">${ct.headline}</h1>
        ${ct.buyerUrl ? `<a class="rv-closing-link" href="${ct.buyerUrl}" target="_blank" rel="noopener">${ct.buyerLabel || ct.buyerUrl} <span>→</span></a>` : ''}
        ${flags ? `<div class="rv-flags">${flags}</div>` : ''}
      </div>
      <div class="rv-closing-contact">
        <div class="rv-contact-row"><span class="rv-contact-k">${T('email')}</span><a class="rv-contact-v rv-contact-link" href="mailto:${ct.email}">${ct.email}</a></div>
        <div class="rv-contact-row"><span class="rv-contact-k">${T('whatsapp')}</span><a class="rv-contact-v rv-contact-link" href="https://wa.me/${waDigits}" target="_blank" rel="noopener">${ct.phone}</a></div>
      </div>
    `);
  }

  function buildCategory(stage, C, g, opts) {
    const add = makeAdd(stage);
    const gUnits = g.items.reduce((a, p) => a + p.qty, 0);
    const gValue = g.items.reduce((a, p) => a + p.price * p.qty, 0);
    const brands = [...new Set(g.items.map((p) => p.brand).filter((b) => b && b !== 'Sin marca'))].slice(0, 6);

    /* Portada de categoría */
    const M = mm(C);
    const gname = catN(g.name);
    add('Portada', 'rv-slide rv-cover rv-divider', `
      <span class="rv-divider-ghost" style="font-size:420px">${gname.charAt(0)}</span>
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(M.eyebrow)} · ${M.title}${M.volume ? ' · ' + M.volume : ''}</span>
        <h1 class="rv-cover-title rv-divider-title">${gname}</h1>
        ${brands.length ? `<p class="rv-cover-intro rv-divider-brands">${brands.join('&nbsp; · &nbsp;')}</p>` : ''}
      </div>
      <div class="rv-cover-stats">
        <div class="rv-stat"><span class="rv-stat-num rv-accent">${g.items.length}</span><span class="rv-stat-lbl">${T('skusInCat')}</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${units(gUnits)}</span><span class="rv-stat-lbl">${T('units')}</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${compact(gValue)}</span><span class="rv-stat-lbl">${T('lotValueShort')} ${M.currency}</span></div>
      </div>
    `, `--cat:${g.color}`);

    const tot = String(g.items.length).padStart(2, '0');
    g.items.forEach((p, i) => {
      productSlide(add, C, g, p, String(i + 1).padStart(2, '0'), tot, opts);
    });

    closing(add, C);
  }

  function buildFull(stage, C, opts) {
    const add = makeAdd(stage);
    const sections = groupAll(C);
    const CT = sections.length;
    const n = C.products.length;
    const totalUnits = C.products.reduce((a, p) => a + p.qty, 0);
    const totalValue = C.products.reduce((a, p) => a + p.price * p.qty, 0);
    const M = mm(C);

    add('Portada', 'rv-slide rv-cover', `
      <img class="rv-cover-symbol" src="assets/rivero-symbol-white.png" alt="">
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(M.eyebrow)}</span>
        <h1 class="rv-cover-title">${M.title}${M.volume ? `<span class="rv-disc-tag" style="font-size:30px">${M.volume}</span>` : ''}</h1>
        <p class="rv-cover-headline">${M.headline}</p>
        <p class="rv-cover-intro">${M.intro}</p>
      </div>
      <div class="rv-cover-stats">
        <div class="rv-stat"><span class="rv-stat-num">${n}</span><span class="rv-stat-lbl">${T('skusAvailable')}</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${CT}</span><span class="rv-stat-lbl">${T('categories')}</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${units(totalUnits)}</span><span class="rv-stat-lbl">${T('totalUnits')}</span></div>
        <div class="rv-stat"><span class="rv-stat-num rv-accent">${compact(totalValue)}</span><span class="rv-stat-lbl">${T('inventoryValue')} ${M.currency}</span></div>
      </div>
    `);

    add(T('categories'), 'rv-slide rv-toc', `
      ${topbar(C)}
      <div class="rv-toc-head">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${T('lotByCategory')}</span>
        <h2 class="rv-toc-title">${CT} ${T('categoriesLower')} · ${n} SKUs</h2>
      </div>
      <ul class="rv-toc-list">
        ${sections.map((g, i) => {
          const gu = g.items.reduce((a, p) => a + p.qty, 0);
          return `<li class="rv-toc-row" style="--cat:${g.color}">
            <span class="rv-toc-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="rv-toc-dot"></span>
            <span class="rv-toc-name">${catN(g.name)}</span>
            <span class="rv-toc-meta">${g.items.length} SKUs &nbsp;·&nbsp; ${units(gu)} ${T('uShort')}</span>
          </li>`;
        }).join('')}
      </ul>
    `);

    let gi = 0;
    const tot = String(n).padStart(2, '0');
    sections.forEach((g, si) => {
      const gUnits = g.items.reduce((a, p) => a + p.qty, 0);
      const gValue = g.items.reduce((a, p) => a + p.price * p.qty, 0);
      const brands = [...new Set(g.items.map((p) => p.brand).filter((b) => b && b !== 'Sin marca'))].slice(0, 6);
      const gname = catN(g.name);
      add(`▸ ${gname}`, 'rv-slide rv-cover rv-divider', `
        <span class="rv-divider-ghost">${String(si + 1).padStart(2, '0')}</span>
        ${topbar(C)}
        <div class="rv-cover-body">
          <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${T('category')} ${String(si + 1).padStart(2, '0')} / ${String(CT).padStart(2, '0')}</span>
          <h1 class="rv-cover-title rv-divider-title">${gname}</h1>
          ${brands.length ? `<p class="rv-cover-intro rv-divider-brands">${brands.join('&nbsp; · &nbsp;')}</p>` : ''}
        </div>
        <div class="rv-cover-stats">
          <div class="rv-stat"><span class="rv-stat-num rv-accent">${g.items.length}</span><span class="rv-stat-lbl">${T('skusInCat')}</span></div>
          <div class="rv-stat"><span class="rv-stat-num">${units(gUnits)}</span><span class="rv-stat-lbl">${T('units')}</span></div>
          <div class="rv-stat"><span class="rv-stat-num">${compact(gValue)}</span><span class="rv-stat-lbl">${T('lotValueShort')} ${M.currency}</span></div>
        </div>
      `, `--cat:${g.color}`);
      g.items.forEach((p) => {
        gi += 1;
        productSlide(add, C, g, p, String(gi).padStart(2, '0'), tot, opts);
      });
    });

    closing(add, C);
  }

  window.RiveroCatalog = {
    CATS,
    build(stage, opts) {
      opts = opts || {};
      const o = { showRetail: opts.showRetail !== false, showSku: opts.showSku !== false };
      const C = window.INVENTORY;
      if (!C || !stage) return;
      while (stage.firstChild) stage.removeChild(stage.firstChild);
      if (opts.category) {
        const g = groupAll(C).find((x) => x.name === opts.category);
        if (g) buildCategory(stage, C, g, o);
      } else {
        buildFull(stage, C, o);
      }
    },
  };
})();
