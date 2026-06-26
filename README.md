# Rivero — Catálogo por categoría (sitio)

Catálogo de inventario de Rivero Commerce, publicado como sitio estático.
Español · sistema métrico · precios mayoristas USD.

## Estructura
- `index.html` — portada / índice por categoría.
- `completo.html` — catálogo completo (todas las categorías en un documento).
- `<categoria>.html` — un documento por categoría (iluminacion, cocina, bano, etc.).
- `products/` — fotos de producto. `assets/` — logos de marca.
- `inventory-data.js` — datos del inventario (editá este archivo para actualizar el catálogo).
- `catalog-render.js`, `deck-stage.js`, `catalog.css`, `colors_and_type.css`, `support.js` — motor y estilos.

## Publicar en GitHub Pages
1. Subí esta carpeta `docs/` al repo (rama `main`).
2. En GitHub: Settings -> Pages.
3. En Source elegí "Deploy from a branch", rama main, carpeta /docs. Guardá.
4. En ~1 minuto queda en https://lbaldonirivero.github.io/rivero-promo/

## Actualizar el inventario
Reemplazá inventory-data.js (mismo formato) y volvé a subir. No hace falta tocar nada más.
