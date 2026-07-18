import { test, expect } from '@playwright/test';

async function enterDemo(page: import('@playwright/test').Page) {
  await page.goto('/?demo=1');
  await expect(page.getByRole('link', { name: /Library/i }).first()).toBeVisible({ timeout: 45_000 });
}

test.describe('Platform spine smoke routes', () => {
  test('match lobby loads in demo', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/match');
    await expect(page.getByRole('heading', { name: /Study Match/i })).toBeVisible({ timeout: 30_000 });
  });

  test('circles page loads in demo', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/circles');
    await expect(page.getByText(/Study Circles|Κύκλοι Μελέτης/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('voice tutor loads in demo', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/voice');
    await expect(page.getByText(/Voice Tutor|Φωνητικός/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('teacher dashboard loads in demo', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/teacher');
    await expect(page.getByText(/Teacher Dashboard|Πίνακας Εκπαιδευτικού/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('dashboard learning OS strip is present', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/');
    await expect(page.getByTestId('learning-os-strip')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('offline-sync-debt')).toBeVisible();
  });
});
