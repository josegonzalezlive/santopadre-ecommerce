# QA visual automatizado

Regresión visual con [Playwright](https://playwright.dev): captura elementos clave del
sitio (header, footer, tarjetas de producto) y los compara pixel a pixel contra
baselines commiteadas. Existe para atrapar en CI bugs como los que antes solo se
detectaban cuando un humano los veía en producción: el grid del footer roto, el badge
de picante tapando el contador de guardados, el watermark superpuesto al hero.

## Correr localmente

```bash
npm run test:visual
```

Levanta `python3 -m http.server 4173` automáticamente (ver `playwright.config.js`) y
corre la suite contra `http://127.0.0.1:4173`.

## Actualizar baselines a propósito

Cuando un cambio de diseño es intencional, las capturas viejas van a fallar — eso es
correcto. Para aceptar el nuevo diseño como baseline:

```bash
npm run test:visual:update
```

Revisa el diff (`git diff` sobre `*-snapshots/*.png`, o abre las imágenes) antes de
commitear para confirmar que el cambio es el esperado y no una regresión.

## Por qué la suite bloquea toda la red

`test/visual/helpers.js` aborta cualquier request fuera de `127.0.0.1:4173` antes de
navegar. Sin eso, el SDK de Firebase (auth, Firestore, App Check/reCAPTCHA) y Google
Fonts tardan un tiempo variable en resolver, y el contador de "guardados" en tiempo real
(`js/user-profile.js` → `listenToProductStats()`) reescribe el DOM a mitad de la
captura — la página nunca se queda quieta. Esta suite valida layout/CSS, no integración
con el backend; para eso están los tests de `test/loyalty.flows.integration.test.mjs`.

Por la misma razón, los `<video>` de producto (autoplay solo on-hover) se pausan y se
ocultan antes de cada captura: siguen decodificando su primer frame en segundo plano
incluso en reposo.

## Agregar una captura nueva

Añade un `test()` en `visual.spec.js` (desktop) o `visual.mobile.spec.js` (mobile,
corre en Chromium con viewport de iPhone 13 — no hace falta el motor WebKit real, solo
nos importa el CSS responsive). Usa `preparePage(page)` de `helpers.js` primero, apunta
un locator específico (no `page` completo, para que el diff señale justo el componente
roto) y corre `npm run test:visual:update` una vez para generar su baseline.
