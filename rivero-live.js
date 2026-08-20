(function() {
  var API_BASE = 'https://rivero-track-backend-production.up.railway.app';
  var API_KEY = (window.RIVERO_API_KEY) || 'rk_inv_674b66a1_d871e932d4bf3d799820bbfbdb80c96d';

  function tryFetch(url) {
    return fetch(url, { headers: { 'x-api-key': API_KEY } })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  var directUrl = API_BASE + '/inventory-items?limit=500';
  var proxyUrl  = 'https://corsproxy.io/?' + directUrl;

  tryFetch(directUrl)
    .catch(function() { return tryFetch(proxyUrl); })
    .then(function(data) {
      var items = Array.isArray(data) ? data : (data.items || data.data || []);
      if (!items.length) return;

      // Build SKU→availableQty map
      var liveQty = {};
      items.forEach(function(item) {
        var sku = String(item.modelId || item.id || '');
        if (sku && typeof item.availableQty === 'number') liveQty[sku] = item.availableQty;
      });

      // Wait for inventory-data.js to set window.INVENTORY, then patch
      function patch() {
        if (!window.INVENTORY || !window.INVENTORY.products) {
          setTimeout(patch, 100);
          return;
        }
        var updated = 0;
        window.INVENTORY.products.forEach(function(p) {
          if (liveQty.hasOwnProperty(p.sku)) {
            p.qty = liveQty[p.sku];
            updated++;
          }
        });
        if (updated > 0) {
          console.log('Rivero live: ' + updated + ' productos actualizados desde API');
          // Signal the page component to re-render
          window.dispatchEvent(new CustomEvent('rivero:live'));
        }
      }
      patch();
    })
    .catch(function(err) {
      console.warn('Rivero live: fallo el fetch, usando datos estáticos.', err.message);
    });
})();
