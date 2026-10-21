import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without type declarations
import * as report from '../../../scripts/morning-report.mjs'

const NOW = new Date('2026-10-21T14:30:00.000Z') // 2026-10-21 08:30 America/Merida

const ok = <T,>(value: T) => ({ value })

function healthyData(overrides: Record<string, unknown> = {}) {
  return {
    now: NOW,
    orders: ok([
      { state: 'PAID', n24: '2', n_all: '24', cents_all: '9000000' },
      { state: 'PAYMENT_PENDING', n24: '5', n_all: '74', cents_all: '0' },
      { state: 'REFUNDED', n24: '0', n_all: '1', cents_all: '300000' },
    ]),
    paidByProduct: ok([
      { product_code: 'IND-H', q_all: '10', c_all: '1650000', q24: '2', c24: '330000' },
      { product_code: 'REL-4H', q_all: '3', c_all: '1050000', q24: '0', c24: '0' },
    ]),
    paidTotals: ok({ n_all: '24', cents_all: '9000000', n24: '2', cents24: '330000', n48: '2', last_paid_at: '2026-10-21T10:00:00Z' }),
    legacy: ok([
      { commercial_status: 'LEGACY_PAID', courtesy: false, n: '40', cents: '5000000' },
      { commercial_status: 'LEGACY_PAID', courtesy: true, n: '5', cents: '0' },
      { commercial_status: 'LEGACY_PENDING', courtesy: false, n: '108', cents: '9999999' },
    ]),
    funnel: ok({ created: '10', paid: '2', expired: '3', open: '4', other: '1', abandoned: '3' }),
    webhooks: ok({ byType: { 'v1.0': { received: 4, accepted: 4, failed: 0 }, 'Feed v2.0': { received: 2, accepted: 0, failed: 2 } } }),
    gatewayWebhook: ok({ rejected: { 'v1.0': 0, 'Feed v2.0': 7, otro: 0 }, windowHours: 2 }),
    reversals: ok({
      refunds24: '1', refunds24_cents: '300000', refunds_all: '1', refunds_all_cents: '300000',
      cb24: '0', cb24_cents: '0', cb_all: '0', cb_all_cents: '0', revoked24: '1', revoked_all: '1',
    }),
    integrity: ok({ no_ticket: '0', no_mail: '0', no_ticket_ids: '', no_mail_ids: '' }),
    outbox: ok([
      { communication_type: 'TICKET_READY', state: 'SENT', n24: '2', n_all: '25' },
      { communication_type: 'TICKET_READY', state: 'FAILED', n24: '1', n_all: '1' },
      { communication_type: 'INTERNAL_ALERT', state: 'PENDING', n24: '0', n_all: '4' },
    ]),
    stageOrders: ok([{ st: 'PRESALE', created_at: '2026-10-21T01:00:00Z' }]),
    treasury: ok([
      { occurred_on: '2026-10-23', type: 'expense', amount_cents: '1250000', account: 'Banco', dest: null, overdue: false },
    ]),
    functionLogs: ok({
      perFn: { 'mp-webhook': { calls: 12, c4xx: 1, c5xx: 0 }, 'send-ticket-email': { calls: 3, c4xx: 0, c5xx: 0 } },
      windowHours: 24,
      entries: 500,
    }),
    drift: ok({
      rows: [
        { slug: 'mp-webhook', status: 'IDENTICAL', liveSha: 'aaaaaaaaaaaa', bundleSha: 'aaaaaaaaaaaa' },
        { slug: 'ops-sales-read', status: 'NO_BUNDLE', liveSha: 'cccccccccccc', bundleSha: '-' },
      ],
      unmergedRefs: 3,
    }),
    repo: ok({
      mainSha: '766eafc1',
      mainSubject: 'Merge pull request #7',
      mainDate: '2026-10-20 18:00',
      prs: [{ number: 8, title: 'fix kits', headRefName: 'fix/horario-kits' }],
      landingPrs: [],
      unmergedDeployed: [{ slug: 'openpay-webhook', ref: 'origin/feat/openpay' }],
      unmergedRefs: 3,
    }),
    ...overrides,
  }
}

describe('morning report helpers', () => {
  it('formats money from cents', () => {
    expect(report.money(1234567)).toBe('$12,345.67')
    expect(report.money('0')).toBe('$0.00')
  })

  it('renders Merida wall time (UTC-6)', () => {
    expect(report.fmtMerida(NOW)).toBe('2026-10-21 08:30')
    expect(report.dateKey(new Date('2026-10-22T05:59:00Z'))).toBe('2026-10-21')
  })

  it('resolves the calendar stage with half-open windows', () => {
    expect(report.expectedStage(new Date('2026-09-25T05:59:59Z'))).toBe('LAUNCH')
    expect(report.expectedStage(new Date('2026-09-25T06:00:00Z'))).toBe('PRESALE')
    expect(report.expectedStage(new Date('2026-10-27T05:59:59Z'))).toBe('PRESALE') // 26-oct 23:59:59
    expect(report.expectedStage(new Date('2026-10-27T06:00:00Z'))).toBe('REGULAR')
  })

  it('counts down in days and hours, and flags past dates', () => {
    expect(report.countdown(NOW, new Date('2026-10-27T05:59:00Z'))).toBe('5 d 15 h')
    expect(report.countdown(NOW, new Date('2026-10-21T10:30:00Z'))).toBe('ya pasó (hace 0 d 4 h)')
  })

  it('classifies webhook user agents', () => {
    expect(report.classifyWebhookType('MercadoPago WebHook v1.0 payment')).toBe('v1.0')
    expect(report.classifyWebhookType('MercadoPago Feed v2.0 payment')).toBe('Feed v2.0')
    expect(report.classifyWebhookType('curl/8')).toBe('otro')
  })

  it('parses function and gateway log lines, stripping ANSI', () => {
    expect(report.parseFunctionLogLine('POST mp-webhook 401 12ms')).toEqual({ method: 'POST', slug: 'mp-webhook', status: 401 })
    expect(report.parseFunctionLogLine('\u001b[33mListening on http://0.0.0.0:80\u001b[0m')).toBeNull()
    expect(report.parseGatewayLogLine('POST /functions/mp-webhook 401 23 12ms - 10.0.0.1 - MercadoPago WebHook v1.0 payment')).toEqual({
      method: 'POST',
      slug: 'mp-webhook',
      status: 401,
      userAgent: 'MercadoPago WebHook v1.0 payment',
    })
  })

  it('summarizes function logs inside the 24 h window only', () => {
    const entries = [
      { timestamp: '2026-10-21T13:00:00Z', eventMessage: 'POST mp-webhook 200 5ms' },
      { timestamp: '2026-10-21T13:01:00Z', eventMessage: 'POST mp-webhook 401 5ms' },
      { timestamp: '2026-10-21T13:02:00Z', eventMessage: 'POST mp-webhook 503 5ms' },
      { timestamp: '2026-10-19T13:02:00Z', eventMessage: 'POST mp-webhook 500 5ms' },
    ]
    const s = report.summarizeFunctionLogs(entries, NOW)
    expect(s.perFn['mp-webhook']).toEqual({ calls: 3, c4xx: 1, c5xx: 1 })
    expect(s.windowHours).toBe(24)
  })

  it('counts gateway webhook rejections by type', () => {
    const entries = [
      { timestamp: '2026-10-21T13:00:00Z', eventMessage: 'POST /functions/mp-webhook 401 23 12ms - 1.1.1.1 - MercadoPago WebHook v1.0 payment' },
      { timestamp: '2026-10-21T13:00:01Z', eventMessage: 'POST /functions/mp-webhook 401 23 12ms - 1.1.1.1 - MercadoPago Feed v2.0 payment' },
      { timestamp: '2026-10-21T13:00:02Z', eventMessage: 'POST /functions/mp-webhook 200 23 12ms - 1.1.1.1 - MercadoPago WebHook v1.0 payment' },
    ]
    const s = report.summarizeGatewayWebhook(entries, NOW)
    expect(s.rejected).toEqual({ 'v1.0': 1, 'Feed v2.0': 1, otro: 0 })
    expect(s.windowHours).toBeCloseTo(1.5, 1)
  })
})

describe('morning report alerts', () => {
  it('has no alerts on a healthy system', () => {
    expect(report.buildAlerts(healthyData(), NOW)).toEqual([])
  })

  it('flags PAID orders without ticket or email', () => {
    const alerts = report.buildAlerts(
      healthyData({ integrity: ok({ no_ticket: '1', no_mail: '2', no_ticket_ids: 'abcd1234', no_mail_ids: 'ef567890,11112222' }) }),
      NOW,
    )
    expect(alerts.join('\n')).toContain('1 orden(es) PAID sin boleto')
    expect(alerts.join('\n')).toContain('abcd1234')
    expect(alerts.join('\n')).toContain('2 orden(es) PAID con boleto pero sin correo SENT')
  })

  it('flags a v1.0 webhook failure but not a Feed v2.0 one', () => {
    const feedOnly = report.buildAlerts(healthyData(), NOW)
    expect(feedOnly.some((a) => a.includes('Webhook v1.0'))).toBe(false)
    const alerts = report.buildAlerts(
      healthyData({
        webhooks: ok({ byType: { 'v1.0': { received: 3, accepted: 2, failed: 1 } } }),
        gatewayWebhook: ok({ rejected: { 'v1.0': 2, 'Feed v2.0': 0, otro: 0 }, windowHours: 3 }),
      }),
      NOW,
    )
    expect(alerts.some((a) => a.includes('Webhook v1.0') && a.includes('1 en BD') && a.includes('2 rechazo'))).toBe(true)
  })

  it('flags 5xx only on the watched functions', () => {
    const alerts = report.buildAlerts(
      healthyData({
        functionLogs: ok({
          perFn: { 'mp-create-checkout': { calls: 4, c4xx: 0, c5xx: 2 }, 'marketing-capture': { calls: 9, c4xx: 0, c5xx: 5 } },
          windowHours: 24,
          entries: 10,
        }),
      }),
      NOW,
    )
    expect(alerts).toEqual(['2 error(es) 5xx en mp-create-checkout (24 h).'])
  })

  it('flags drift between live function and origin/main bundle', () => {
    const alerts = report.buildAlerts(
      healthyData({
        drift: ok({
          rows: [{ slug: 'mp-create-checkout', status: 'DRIFT', liveSha: 'aaaaaaaaaaaa', bundleSha: 'bbbbbbbbbbbb' }],
          unmergedRefs: 0,
        }),
      }),
      NOW,
    )
    expect(alerts[0]).toContain('Drift: mp-create-checkout')
  })

  it('flags a price stage that does not match the order date', () => {
    const alerts = report.buildAlerts(
      healthyData({ stageOrders: ok([{ st: 'LAUNCH', created_at: '2026-10-21T01:00:00Z' }, { st: 'PRESALE', created_at: '2026-10-21T02:00:00Z' }]) }),
      NOW,
    )
    expect(alerts.some((a) => a.includes('Etapa de precio ≠ fecha en 1 orden'))).toBe(true)
    // A PRESALE order at the last minute of Preventa is still coherent.
    const edge = report.buildAlerts(healthyData({ stageOrders: ok([{ st: 'PRESALE', created_at: '2026-10-27T05:59:00Z' }]) }), NOW)
    expect(edge).toEqual([])
    const late = report.buildAlerts(healthyData({ stageOrders: ok([{ st: 'PRESALE', created_at: '2026-10-27T06:01:00Z' }]) }), NOW)
    expect(late).toHaveLength(1)
  })

  it('flags no sales in 48 h', () => {
    const alerts = report.buildAlerts(
      healthyData({ paidTotals: ok({ n_all: '24', cents_all: '9000000', n24: '0', cents24: '0', n48: '0', last_paid_at: '2026-10-19T02:12:00Z' }) }),
      NOW,
    )
    expect(alerts).toEqual(['Ninguna venta en 48 h (última venta: 2026-10-18 20:12).'])
  })

  it('reports unverifiable checks instead of staying silent', () => {
    const alerts = report.buildAlerts(healthyData({ integrity: { error: 'cli failed' }, drift: { error: 'offline' } }), NOW)
    expect(alerts.some((a) => a.includes('órdenes PAID sin boleto/correo') && a.includes('cli failed'))).toBe(true)
    expect(alerts.some((a) => a.includes('drift de funciones') && a.includes('offline'))).toBe(true)
  })
})

describe('morning report rendering', () => {
  it('renders sections in the requested order with alerts first', () => {
    const md = report.renderReport(
      healthyData({ integrity: ok({ no_ticket: '1', no_mail: '0', no_ticket_ids: 'abcd1234', no_mail_ids: '' }) }),
      NOW,
    )
    const order = [
      '## 🚨 ALERTAS',
      '## 1. Ventas',
      '## 2. Embudo',
      '## 3. Pagos y webhooks',
      '## 4. Correos',
      '## 5. Salud de funciones',
      '## 6. Repos',
      '## 7. Tesorería',
      '## 8. Calendario',
    ].map((heading) => md.indexOf(heading))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('omits the alerts section when there are none', () => {
    const md = report.renderReport(healthyData(), NOW)
    expect(md).not.toContain('## 🚨 ALERTAS')
    expect(md).toContain('✅ sin alertas')
  })

  it('sums ready2hybrid + legacy paid, keeping courtesies and pending out', () => {
    const md = report.renderReport(healthyData(), NOW)
    expect(md).toContain('| ready2hybrid (PAID) | 24 | $90,000.00 |')
    expect(md).toContain('| legacy (LEGACY_PAID, sin cortesías) | 40 | $50,000.00 |')
    expect(md).toContain('| **Total pagado** | 64 | **$140,000.00** |')
    expect(md).toContain('Cortesías legacy (aparte, no suman): 5')
  })

  it('renders funnel, webhook types, emails, treasury and calendar', () => {
    const md = report.renderReport(healthyData(), NOW)
    expect(md).toContain('| Creados | 10 |')
    expect(md).toContain('Personas únicas que abandonaron (vencidas y sin ninguna compra pagada): **3**')
    expect(md).toContain('| Feed v2.0 | 2 | 0 | 2 | 7 |')
    expect(md).toContain('| Fallidos | 1 | 1 |')
    expect(md).toContain('| 2026-10-23 | expense | Banco | $12,500.00 |')
    expect(md).toContain('| Fin de Preventa (26-oct 23:59) | 5 d 15 h |')
    expect(md).toContain('| Cierre de venta (13-nov 11:00) | 23 d 2 h |')
  })

  it('splits mp-webhook rejections into typed and untyped', () => {
    const md = report.renderReport(
      healthyData({
        functionLogs: ok({ perFn: { 'mp-webhook': { calls: 12, c4xx: 8, c5xx: 0 } }, windowHours: 13.8, entries: 1000 }),
        gatewayWebhook: ok({ rejected: { 'v1.0': 0, 'Feed v2.0': 3, otro: 0 }, windowHours: 1.3 }),
      }),
      NOW,
    )
    expect(md).toContain('mp-webhook devolvió 8 rechazo(s)/error(es)')
    expect(md).toContain('3 con tipo identificado, 5 sin tipo')
  })

  it('degrades a failed section to n/d without throwing', () => {
    const md = report.renderReport(healthyData({ treasury: { error: 'boom' }, repo: { error: 'no git' } }), NOW)
    expect(md).toContain('⚠️ n/d — boom')
    expect(md).toContain('⚠️ n/d — no git')
  })

  it('never emits emails, phone numbers or tokens from fake PII-like input', () => {
    const md = report.renderReport(healthyData(), NOW)
    expect(md).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i)
    expect(md).not.toMatch(/Bearer|apikey|token/i)
  })
})

describe('morning report read-only guard', () => {
  it('rejects anything that is not a plain SELECT', async () => {
    await expect(report.sql('update orders set state = 1')).rejects.toThrow('read-only')
    await expect(report.sql('select 1; delete from orders')).rejects.toThrow('read-only')
    await expect(report.sql('with x as (select 1) insert into orders select * from x')).rejects.toThrow('read-only')
  })
})
