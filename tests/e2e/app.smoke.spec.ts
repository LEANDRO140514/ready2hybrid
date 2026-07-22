import { expect, test } from '@playwright/test'

test('loads the Ready2Hybrid foundation', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Ready2Hybrid', exact: true }),
  ).toBeVisible()
})
