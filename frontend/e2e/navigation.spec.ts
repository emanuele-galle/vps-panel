import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to login from home', async ({ page }) => {
    await page.goto('/');
    // La home dovrebbe redirigere a login se non autenticato
    await expect(page).toHaveURL(/login/);
  });
});
