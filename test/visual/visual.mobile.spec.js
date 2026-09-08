// Regresión visual (mobile) — ver visual.spec.js para el contexto general.
const { test, expect } = require('@playwright/test');
const { preparePage } = require('./helpers');

test.describe('Layout crítico (mobile)', () => {
  test('header — corazón de wishlist junto al carrito', async ({ page }) => {
    await preparePage(page);
    await expect(page.locator('#header')).toHaveScreenshot('header-mobile.png');
  });

  test('footer', async ({ page }) => {
    await preparePage(page);
    const footer = page.locator('#footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot('footer-mobile.png');
  });
});
