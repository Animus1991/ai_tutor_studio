import { test, expect } from '@playwright/test';

async function enterDemo(page: import('@playwright/test').Page) {
  await page.goto('/?demo=1');
  await expect(page.getByRole('link', { name: /Library/i }).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('340 XP')).toBeVisible({ timeout: 30_000 });
}

test.describe('Demo sandbox flows', () => {
  test('library lists demo courses and opens study workspace', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/library');
    await expect(page.getByText('Your Courses')).toBeVisible();
    await page.getByRole('button', { name: /View details for Demo: Microeconomics/i }).click();
    await expect(page).toHaveURL(/\/study\/demo-course-micro/);
    await expect(page.getByText(/Study Workspace ·/)).toBeVisible();
    await expect(page.getByText('Lesson Steps')).toBeVisible();
  });

  test('tasks page loads with demo task data', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.getByText('Review Cournot vs Bertrand models')).toBeVisible({ timeout: 20_000 });
  });

  test('upload modal opens from library', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/library');
    await page.getByRole('button', { name: 'Open document workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Upload & Generate Course' })).toBeVisible();
    await expect(page.getByText('Drop PDF or text file')).toBeVisible();
  });

  test('direct study workspace URL works in demo', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/study/demo-course-micro');
    await expect(page.getByText(/Study Workspace ·/)).toBeVisible();
    await expect(page.getByText(/Microeconomics/i).first()).toBeVisible();
  });
});
