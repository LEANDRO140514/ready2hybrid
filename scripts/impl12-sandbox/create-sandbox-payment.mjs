/**
 * Creates a sandbox payment against an existing order external_reference.
 * Reads MERCADOPAGO_ACCESS_TOKEN from InsForge CLI secrets via env IMPL12_MP_TOKEN
 * (never logged). Card data is official MP test data and is not persisted.
 */
import { createHmac, randomUUID } from 'node:crypto'

const token = process.env.IMPL12_MP_TOKEN
const publicKey = process.env.IMPL12_MP_PUBLIC_KEY
if (!token) {
  console.error('MISSING_IMPL12_MP_TOKEN')
  process.exit(2)
}
if (!publicKey) {
  console.error('MISSING_IMPL12_MP_PUBLIC_KEY')
  process.exit(2)
}

const externalReference = process.argv[2]
const amount = Number(process.argv[3] || '300')
const scenario = (process.argv[4] || 'APRO').toUpperCase() // APRO | OTHE | CONT
if (!externalReference) {
  console.error('USAGE: create-sandbox-payment.mjs <external_reference> <amount> [APRO|OTHE|CONT]')
  process.exit(2)
}

const cardholders = {
  APRO: { name: 'APRO', status: 'approved' },
  OTHE: { name: 'OTHE', status: 'rejected' },
  CONT: { name: 'CONT', status: 'pending' },
}
const holder = cardholders[scenario]
if (!holder) {
  console.error('BAD_SCENARIO')
  process.exit(2)
}

async function mp(path, init = {}, auth = 'access') {
  const headers = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': randomUUID(),
    ...(init.headers || {}),
  }
  let url = `https://api.mercadopago.com${path}`
  if (auth === 'access') headers.Authorization = `Bearer ${token}`
  if (auth === 'public') {
    url += (url.includes('?') ? '&' : '?') + `public_key=${encodeURIComponent(publicKey)}`
  }
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, json, text: text.slice(0, 500) }
}

const tokenBodies = [
  {
    card_number: '5031755734530604',
    security_code: '123',
    expiration_month: 11,
    expiration_year: 2030,
    cardholder: { name: holder.name },
  },
]

let tokenRes = null
for (const body of tokenBodies) {
  tokenRes = await mp('/v1/card_tokens', { method: 'POST', body: JSON.stringify(body) }, 'public')
  if (tokenRes.status < 300 && tokenRes.json?.id) break
}

if (!tokenRes || tokenRes.status >= 300 || !tokenRes.json?.id) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        step: 'card_token',
        status: tokenRes?.status,
        error: tokenRes?.json?.message || tokenRes?.json?.error || 'token_failed',
        causes: Array.isArray(tokenRes?.json?.cause)
          ? tokenRes.json.cause.map((c) => ({ code: c.code, description: c.description }))
          : null,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const payRes = await mp('/v1/payments', {
  method: 'POST',
  body: JSON.stringify({
    transaction_amount: amount,
    token: tokenRes.json.id,
    description: `IMPL12 sandbox ${scenario}`,
    installments: 1,
    payment_method_id: 'master',
    payer: {
      email: `impl12.sbx.${scenario.toLowerCase()}.${Date.now()}@example.com`,
    },
    external_reference: externalReference,
  }),
})

const payment = payRes.json || {}
console.log(
  JSON.stringify(
    {
      ok: payRes.status < 300,
      http_status: payRes.status,
      payment_id: payment.id ? String(payment.id) : null,
      status: payment.status || null,
      status_detail: payment.status_detail || null,
      live_mode: payment.live_mode ?? null,
      external_reference: payment.external_reference || null,
      transaction_amount: payment.transaction_amount ?? null,
      currency_id: payment.currency_id || null,
      expected_scenario: holder.status,
      error: payment.message || payment.error || null,
      causes: Array.isArray(payment.cause)
        ? payment.cause.map((c) => ({ code: c.code, description: c.description }))
        : null,
      token_meta: {
        len: token.length,
        prefix: token.startsWith('APP_USR-') ? 'APP_USR' : token.startsWith('TEST-') ? 'TEST' : 'OTHER',
      },
    },
    null,
    2,
  ),
)
process.exit(payRes.status < 300 && payment.id ? 0 : 1)
