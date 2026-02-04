import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/VPS Console/);
    await expect(page.getByRole('heading', { name: /accedi/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /accedi/i }).click();
    await expect(page.getByText(/email.*obbligatori/i)).toBeVisible();
  });

  test('should redirect to dashboard after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@fodivps1.cloud');
    await page.getByLabel(/password/i).fill('Test123!@#');
    await page.getByRole('button', { name: /accedi/i }).click();
    // Verifica redirect (potrebbe fallire se credenziali non valide)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});
