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
  const units = (n) => Number(n).toLocaleString('es-AR');
  const compact = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : money(n));
  const up = (s) => (s || '').toUpperCase();
  const clean = (s) => (s || '').replace(/"/g, '\u201D');

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
    return `<header class="rv-topbar">
      <img class="rv-logo" src="assets/rivero-logo-lineal-white.png" alt="Rivero">
      <span class="rv-topbar-meta">${up(C.meta.location)} &nbsp;·&nbsp; ${up(C.meta.terms)}</span>
    </header>`;
  }

  function productSlide(add, C, g, p, idx, tot, opts) {
    const hasPrice = p.price > 0;
    const low = p.qty <= 20;
    const lote = p.price * p.qty;
    const hasDisc = opts.showRetail && p.retail > p.price && p.price > 0;
    const discPct = hasDisc ? Math.round((1 - p.price / p.retail) * 100) : 0;
    const priceBlock = hasPrice
      ? `<span class="rv-pstat-val rv-accent">${money(p.price, 2)}</span>` +
        (hasDisc ? ` <s class="rv-retail-strike">retail ${money(p.retail, 2)}</s>` : '')
      : `<span class="rv-pstat-val rv-accent" style="font-size:48px">A consultar</span>`;
    add(`${idx} · ${p.name}`, 'rv-slide rv-product', `
      <div class="rv-prod-media">
        <span class="rv-prod-index">${idx} <em>/ ${tot}</em></span>
        <span class="rv-prod-cat"><i></i>${up(g.name)}</span>
        <div class="rv-prod-tile"><img src="${p.img}" alt="${clean(p.name)}"></div>
        <span class="rv-stock-dot"><i></i>${low ? 'Consultar disponibilidad' : units(p.qty) + ' unidades en stock'}</span>
      </div>
      <div class="rv-prod-info">
        <div class="rv-prod-info-top">
          <span class="rv-eyebrow rv-accent">${up(C.meta.eyebrow)} &nbsp;·&nbsp; ${up(g.name)}</span>
          ${p.brand ? `<div class="rv-prod-brand">${up(p.brand)}</div>` : ''}
          <h2 class="rv-prod-name">${clean(p.name)}</h2>
          ${opts.showSku ? `<div class="rv-prod-sku">SKU ${p.sku}</div>` : ''}
        </div>
        <div class="rv-prod-stats">
          <div class="rv-pstat rv-pstat-price">
            <span class="rv-pstat-lbl">${C.meta.priceLabel} ${C.meta.currency}${hasDisc ? ` <span class="rv-disc-pill">&minus;${discPct}%</span>` : ''}</span>
            <span class="rv-price-line">${priceBlock}</span>
          </div>
          <div class="rv-pstat">
            <span class="rv-pstat-lbl">Stock disponible</span>
            ${low ? '<span class="rv-pstat-val" style="font-size:30px">Consultar disponibilidad</span>' : '<span class="rv-pstat-val">' + units(p.qty) + ' <small>u.</small></span>'}
          </div>
          <div class="rv-pstat">
            <span class="rv-pstat-lbl">Valor del lote</span>
            <span class="rv-pstat-val">${low ? '—' : (hasPrice ? money(lote) : '—')} <small>${(!low && hasPrice) ? C.meta.currency : ''}</small></span>
          </div>
        </div>
        <div class="rv-prod-foot">
          <span class="rv-chip rv-chip-ok"><i></i>Disponible · ${C.meta.location}</span>
          <span class="rv-chip">FOB · ${C.meta.currency}</span>
          <img class="rv-prod-logo" src="assets/rivero-logo-lineal.png" alt="Rivero">
        </div>
      </div>
    `, `--cat:${g.color}`);
  }

  function closing(add, C) {
    const ct = C.contact;
    const flags = (ct.countries || [])
      .map((c) => `<img class="rv-flag" src="assets/flags/${c.code}.svg" alt="${c.name}" title="${c.name}">`)
      .join('');
    const waDigits = (ct.whatsapp || ct.phone || '').replace(/\D/g, '');
    add('Próximos pasos', 'rv-slide rv-cover rv-closing', `
      <img class="rv-cover-symbol" src="assets/rivero-symbol-white.png" alt="">
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(ct.eyebrow)}</span>
        <h1 class="rv-cover-title rv-closing-title">${ct.headline}</h1>
        ${flags ? `<div class="rv-flags">${flags}</div>` : ''}
      </div>
      <div class="rv-closing-contact">
        <div class="rv-contact-row"><span class="rv-contact-k">Email</span><a class="rv-contact-v rv-contact-link" href="mailto:${ct.email}">${ct.email}</a></div>
        <div class="rv-contact-row"><span class="rv-contact-k">WhatsApp</span><a class="rv-contact-v rv-contact-link" href="https://wa.me/${waDigits}" target="_blank" rel="noopener">${ct.phone}</a></div>
      </div>
    `);
  }

  function buildCategory(stage, C, g, opts) {
    const add = makeAdd(stage);
    const gUnits = g.items.reduce((a, p) => a + p.qty, 0);
    const gValue = g.items.reduce((a, p) => a + p.price * p.qty, 0);
    const brands = [...new Set(g.items.map((p) => p.brand).filter((b) => b && b !== 'Sin marca'))].slice(0, 6);

    /* Portada de categoría */
    add('Portada', 'rv-slide rv-cover rv-divider', `
      <span class="rv-divider-ghost" style="font-size:420px">${g.name.charAt(0)}</span>
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(C.meta.eyebrow)} · ${C.meta.title}${C.meta.volume ? ' · ' + C.meta.volume : ''}</span>
        <h1 class="rv-cover-title rv-divider-title">${g.name}</h1>
        ${brands.length ? `<p class="rv-cover-intro rv-divider-brands">${brands.join('&nbsp; · &nbsp;')}</p>` : ''}
      </div>
      <div class="rv-cover-stats">
        <div class="rv-stat"><span class="rv-stat-num rv-accent">${g.items.length}</span><span class="rv-stat-lbl">SKUs en la categoría</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${units(gUnits)}</span><span class="rv-stat-lbl">Unidades</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${compact(gValue)}</span><span class="rv-stat-lbl">Valor de lote ${C.meta.currency}</span></div>
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

    add('Portada', 'rv-slide rv-cover', `
      <img class="rv-cover-symbol" src="assets/rivero-symbol-white.png" alt="">
      ${topbar(C)}
      <div class="rv-cover-body">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>${up(C.meta.eyebrow)}</span>
        <h1 class="rv-cover-title">${C.meta.title}${C.meta.volume ? `<span class="rv-disc-tag" style="font-size:30px">${C.meta.volume}</span>` : ''}</h1>
        <p class="rv-cover-headline">${C.meta.headline}</p>
        <p class="rv-cover-intro">${C.meta.intro}</p>
      </div>
      <div class="rv-cover-stats">
        <div class="rv-stat"><span class="rv-stat-num">${n}</span><span class="rv-stat-lbl">SKUs disponibles</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${CT}</span><span class="rv-stat-lbl">Categorías</span></div>
        <div class="rv-stat"><span class="rv-stat-num">${units(totalUnits)}</span><span class="rv-stat-lbl">Unidades totales</span></div>
        <div class="rv-stat"><span class="rv-stat-num rv-accent">${compact(totalValue)}</span><span class="rv-stat-lbl">Valor de inventario ${C.meta.currency}</span></div>
      </div>
    `);

    add('Categorías', 'rv-slide rv-toc', `
      ${topbar(C)}
      <div class="rv-toc-head">
        <span class="rv-eyebrow rv-eyebrow-accent"><i></i>El lote por categoría</span>
        <h2 class="rv-toc-title">${CT} categorías · ${n} SKUs</h2>
      </div>
      <ul class="rv-toc-list">
        ${sections.map((g, i) => {
          const gu = g.items.reduce((a, p) => a + p.qty, 0);
          return `<li class="rv-toc-row" style="--cat:${g.color}">
            <span class="rv-toc-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="rv-toc-dot"></span>
            <span class="rv-toc-name">${g.name}</span>
            <span class="rv-toc-meta">${g.items.length} SKUs &nbsp;·&nbsp; ${units(gu)} u.</span>
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
      add(`▸ ${g.name}`, 'rv-slide rv-cover rv-divider', `
        <span class="rv-divider-ghost">${String(si + 1).padStart(2, '0')}</span>
        ${topbar(C)}
        <div class="rv-cover-body">
          <span class="rv-eyebrow rv-eyebrow-accent"><i></i>Categoría ${String(si + 1).padStart(2, '0')} / ${String(CT).padStart(2, '0')}</span>
          <h1 class="rv-cover-title rv-divider-title">${g.name}</h1>
          ${brands.length ? `<p class="rv-cover-intro rv-divider-brands">${brands.join('&nbsp; · &nbsp;')}</p>` : ''}
        </div>
        <div class="rv-cover-stats">
          <div class="rv-stat"><span class="rv-stat-num rv-accent">${g.items.length}</span><span class="rv-stat-lbl">SKUs en la categoría</span></div>
          <div class="rv-stat"><span class="rv-stat-num">${units(gUnits)}</span><span class="rv-stat-lbl">Unidades</span></div>
          <div class="rv-stat"><span class="rv-stat-num">${compact(gValue)}</span><span class="rv-stat-lbl">Valor de lote ${C.meta.currency}</span></div>
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
