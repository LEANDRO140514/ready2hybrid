import { expect, test } from '@playwright/test'

async function seed(page: import('@playwright/test').Page, role: string, assignment: boolean) {
  await page.addInitScript(
    ({ role, assignment }) => {
      localStorage.setItem(
        'r2h.e2e.session',
        JSON.stringify({
          id: 'fixture-user',
          email: role === 'FINANCE' ? 'finance@example.com' : 'staff@example.com',
        }),
      )
      localStorage.setItem('r2h.e2e.role', role)
      if (assignment) {
        localStorage.setItem(
          'r2h.e2e.assignment',
          JSON.stringify({
            operatorId: 'fixture-user',
            role,
            eventId: 'evt',
            eventDayId: 'day1',
            doorOrAreaId: 'gate-a',
            validFrom: '2020-01-01T00:00:00.000Z',
            validTo: '2099-01-01T00:00:00.000Z',
            sourceVersion: 'e2e',
          }),
        )
      } else {
        localStorage.removeItem('r2h.e2e.assignment')
      }
    },
    { role, assignment },
  )
}

test('FINANCE reads the sales dashboard without a door assignment', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await seed(page, 'FINANCE', false)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/ops/finance')
  await expect(page.getByTestId('session-role')).toContainText('FINANCE')
  await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ventas' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check-in' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Mesa' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Community Partners' })).toHaveCount(0)
  await page.goto('/ops/checkin')
  await expect(page.getByTestId('unauthorized')).toBeVisible()
  await page.goto('/ops/desk')
  await expect(page.getByTestId('unauthorized')).toBeVisible()
  await page.goto('/ops/partners')
  await expect(page.getByTestId('unauthorized')).toBeVisible()
  await page.goto('/ops/finance')
  await expect(page.getByTestId('kpi-paid')).toContainText('3')
  await expect(page.getByTestId('kpi-revenue')).toContainText('4,800')
  await expect(page.getByTestId('kpi-participants')).toContainText('4')
  await expect(page.getByText('ana@example.com')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Ventas' }).click()
  await page.getByRole('button', { name: 'TRK-IND' }).click()
  await expect(page.getByTestId('order-detail')).toContainText('ana@example.com')
  await expect(page.getByTestId('order-detail')).toContainText('estado del boleto: REVOKED')
  await expect(page.getByTestId('order-detail')).toContainText('Envío: SENT')
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(page.getByTestId('kpi-paid')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('kpi-paid')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ana López/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('CHECKIN_STAFF cannot open the sales dashboard', async ({ page }) => {
  await seed(page, 'CHECKIN_STAFF', true)
  await page.goto('/ops/finance')
  await expect(page.getByTestId('unauthorized')).toBeVisible()
  await expect(page.getByTestId('kpi-paid')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ventas' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Check-in' })).toBeVisible()
})
