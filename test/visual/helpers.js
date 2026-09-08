async function preparePage(page) {
  // Estas pruebas verifican layout/CSS, no integración con Firebase. Bloqueamos toda
  // llamada de red fuera del propio servidor estático: sin esto, el SDK de Firebase
  // (auth, Firestore, App Check/reCAPTCHA) y Google Fonts tardan un tiempo variable en
  // resolver, y el contador de "guardados" en tiempo real reescribe el DOM a mitad de
  // la captura — eso es lo que hacía que las capturas nunca se quedaran quietas.
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:4173')) return route.continue();
    return route.abort();
  });

  await page.goto('/index.html');

  // Cierra el modal de bienvenida ("¡Visítanos!"): aparece 300ms después de
  // DOMContentLoaded (index.html), así que hay que esperarlo, no solo comprobar una vez
  // si ya está visible — si no, aparece a mitad de una captura y tapa media pantalla.
  await page.locator('#infoModalClose').click({ timeout: 2000 }).catch(() => {});

  // Neutraliza animaciones/transiciones y fuerza el estado final de los elementos
  // `.reveal` (fade-in on scroll) para que las capturas sean deterministas.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      .reveal { opacity: 1 !important; transform: none !important; }
    `,
  });

  // Los videos de producto (autoplay solo on-hover) siguen decodificando su primer
  // frame en segundo plano incluso en reposo, lo que corría el punto de comparación de
  // Playwright y nunca dejaba la captura "quieta". Se congelan porque esta suite valida
  // layout, no el contenido exacto del video.
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => {
      v.pause();
      v.style.visibility = 'hidden';
    });
  });
}

module.exports = { preparePage };
