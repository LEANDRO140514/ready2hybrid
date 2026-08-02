import { expect, test } from '@playwright/test'

test('loads the Ready2Hybrid shell without operational readiness claim', async ({
  page,
}) => {
  const response = await page.goto('/')

  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Ready2Hybrid', exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('not-ready-operate')).toBeVisible()
  await expect(
    page.getByText('LISTO PARA OPERAR SIN INTERNET'),
  ).toHaveCount(0)
})

test('unauthenticated user is blocked from operational check-in route', async ({
  page,
}) => {
  await page.goto('/ops/checkin')
  await expect(page).toHaveURL(/\/login$/)
})

test('authenticated fixture without assignment is denied', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'r2h.e2e.session',
      JSON.stringify({ id: 'fixture-user', email: 'staff@example.com' }),
    )
    localStorage.setItem('r2h.e2e.role', 'CHECKIN_STAFF')
    localStorage.removeItem('r2h.e2e.assignment')
  })

  await page.goto('/ops/checkin')
  await expect(page.getByTestId('unauthorized')).toBeVisible()
})

test('logout clears fixture session and revokes operational access', async ({
  page,
}) => {
  // Set grants once (not via addInitScript) so logout is not overwritten on reload.
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'r2h.e2e.session',
      JSON.stringify({ id: 'fixture-user', email: 'staff@example.com' }),
    )
    localStorage.setItem('r2h.e2e.role', 'CHECKIN_STAFF')
    localStorage.setItem(
      'r2h.e2e.assignment',
      JSON.stringify({
        operatorId: 'fixture-user',
        role: 'CHECKIN_STAFF',
        eventId: 'evt',
        eventDayId: 'day1',
        doorOrAreaId: 'gate-a',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '2099-01-01T00:00:00.000Z',
        sourceVersion: 'e2e',
      }),
    )
  })

  await page.goto('/ops/checkin')
  await expect(page.getByTestId('ops-allowed-/ops/checkin')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByTestId('session-user')).toHaveCount(0)

  await page.goto('/ops/checkin')
  await expect(page).toHaveURL(/\/login$/)

  const stored = await page.evaluate(() => ({
    session: localStorage.getItem('r2h.e2e.session'),
    role: localStorage.getItem('r2h.e2e.role'),
    assignment: localStorage.getItem('r2h.e2e.assignment'),
  }))
  expect(stored.session).toBeNull()
  expect(stored.role).toBeNull()
  expect(stored.assignment).toBeNull()
})

test('shell shows offline connectivity without operational readiness claim', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ready2Hybrid' })).toBeVisible()
  await expect(page.getByTestId('not-ready-operate')).toBeVisible()

  await context.setOffline(true)

  await expect(page.getByTestId('connectivity-offline')).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByTestId('not-ready-operate')).toBeVisible()
  await expect(
    page.getByText('LISTO PARA OPERAR SIN INTERNET'),
  ).toHaveCount(0)
})
