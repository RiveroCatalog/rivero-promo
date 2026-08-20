(function() {
  var WORKER_URL = 'https://rivero-catalog.lucas-af2.workers.dev';

  fetch(WORKER_URL)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      var items = Array.isArray(data) ? data : (data.items || []);
      if (!items.length) return;

      var liveQty = {};
      items.forEach(function(item) {
        var sku = String(item.modelId || item.id || '');
        if (sku && typeof item.availableQty === 'number') liveQty[sku] = item.availableQty;
      });

      function patch() {
        if (!window.INVENTORY || !window.INVENTORY.products) { setTimeout(patch, 100); return; }
        var updated = 0;
        window.INVENTORY.products.forEach(function(p) {
          if (liveQty.hasOwnProperty(p.sku)) { p.qty = liveQty[p.sku]; updated++; }
        });
        if (updated > 0) {
          console.log('Rivero live: ' + updated + ' productos actualizados desde API');
          window.dispatchEvent(new CustomEvent('rivero:live'));
        }
      }
      patch();
    })
    .catch(function(err) {
      console.warn('Rivero live: fallo el fetch, usando datos estáticos.', err.message);
    });
})();
