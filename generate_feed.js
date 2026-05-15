const fs = require('fs');

// Read the catalog file and evaluate it to get the CATALOG object
let catalogContent = fs.readFileSync('./js/catalog.js', 'utf8');
catalogContent = catalogContent.replace('const CATALOG =', 'var CATALOG =');
eval(catalogContent);

let xml = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>SantoPadre® | Menú Completo</title>
    <link>https://santopadre.store</link>
    <description>Auténtica Comida Mexicana Gourmet en Araure, Portuguesa.</description>
`;

let count = 0;

CATALOG.categories.forEach(cat => {
  cat.items.forEach(item => {
    count++;
    // Determine price
    let price = item.price || 0;
    if (item.hasVariants && item.variants && item.variants.length > 0) {
      price = item.variants[0].price; // Use base price
    }
    if (price === 0) return; // Skip items with no price (like pase corporativo)
    
    // Determine image
    let image = item.image || "assets/menu/tacos-pastor.avif"; // fallback
    if (!image.startsWith('http')) {
      image = "https://santopadre.store/" + image;
    }
    
    // Ensure absolute link
    let link = `https://santopadre.store/#section-${cat.id}`;
    
    // Escape XML entities
    let desc = item.description || cat.name;
    desc = desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let title = item.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    xml += `
    <item>
      <g:id>${item.id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${image}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${price.toFixed(2)} USD</g:price>
      <g:condition>new</g:condition>
      <g:product_type>Alimentos y Bebidas &gt; Comidas Preparadas</g:product_type>
      <g:brand>SantoPadre</g:brand>
    </item>`;
  });
});

xml += `
  </channel>
</rss>`;

fs.writeFileSync('feed.xml', xml);
console.log(`Successfully generated feed.xml with ${count} products.`);
