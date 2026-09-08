// Regresión visual (desktop): captura estados clave del sitio y los compara pixel a
// pixel contra baselines commiteadas (visual.spec.js-snapshots/). Existe para atrapar
// bugs como el grid del footer roto, el badge de picante tapando el contador de
// guardados, o el watermark superpuesto — todos llegaron a producción sin QA visual
// antes de que un humano los reportara.
//
// `npm run test:visual` corre esta suite. `npm run test:visual:update` regenera los
// baselines a propósito cuando un cambio de diseño es intencional.
const { test, expect } = require('@playwright/test');
const { preparePage } = require('./helpers');

test.describe('Layout crítico (desktop)', () => {
  test('header', async ({ page }) => {
    await preparePage(page);
    await expect(page.locator('#header')).toHaveScreenshot('header-desktop.png');
  });

  test('footer', async ({ page }) => {
    await preparePage(page);
    const footer = page.locator('#footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot('footer.png');
  });

  test('tarjeta de producto — Quesadilla de Chistorra (badge de picante + guardados)', async ({ page }) => {
    await preparePage(page);
    const card = page.locator('#product-quesadilla-chistorra');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveScreenshot('card-quesadilla-chistorra.png');
  });

  test('tarjeta de producto — Tacos de Birria (badge "FAVORITO")', async ({ page }) => {
    await preparePage(page);
    const card = page.locator('#product-tacos-birria');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveScreenshot('card-tacos-birria.png');
  });

  test('hero — sin watermark ni hint de link', async ({ page }) => {
    await preparePage(page);
    await expect(page.locator('#hero')).toHaveScreenshot('hero.png');
  });
});
