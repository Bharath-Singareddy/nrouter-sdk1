import { test, expect } from '@playwright/test';

test('generates Social Media', async ({ page }) => {
  await page.goto('/');
  await page.fill('#idea', 'zero-latency fallbacks');
  page.once('dialog', dialog => dialog.accept());
  await page.click('#generateBtn');
  
  // Wait for the output to populate with something
  await expect(page.locator('#output')).not.toBeEmpty({ timeout: 60000 });
  
  const text = await page.locator('#output').textContent();
  expect(text).toContain('latency');
});
