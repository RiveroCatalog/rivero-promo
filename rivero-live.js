(function() {
  var WORKER_URL = 'https://rivero-catalog.lucas-af2.workers.dev';

  console.log('Rivero live: iniciando fetch desde Worker...');

  fetch(WORKER_URL)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      var items = Array.isArray(data) ? data : (data.items || []);
      console.log('Rivero live: Worker devolvió ' + items.length + ' items');
      if (items.length > 0) {
        console.log('Rivero live: ejemplo modelId API →', items[0].modelId, '| id →', items[0].id);
      }

      var liveQty = {};
      items.forEach(function(item) {
        var sku = String(item.modelId || item.id || '');
        if (sku && typeof item.availableQty === 'number') liveQty[sku] = item.availableQty;
      });

      function patch() {
        if (!window.INVENTORY || !window.INVENTORY.products) { setTimeout(patch, 100); return; }
        console.log('Rivero live: catálogo tiene ' + window.INVENTORY.products.length + ' productos');
        console.log('Rivero live: ejemplo SKU catálogo →', window.INVENTORY.products[0].sku);
        var updated = 0;
        window.INVENTORY.products.forEach(function(p) {
          if (liveQty.hasOwnProperty(p.sku)) { p.qty = liveQty[p.sku]; updated++; }
        });
        console.log('Rivero live: ' + updated + ' matches encontrados');
        if (updated > 0) window.dispatchEvent(new CustomEvent('rivero:live'));
      }
      patch();
    })
    .catch(function(err) {
      console.warn('Rivero live: error en fetch →', err.message);
    });
})();
