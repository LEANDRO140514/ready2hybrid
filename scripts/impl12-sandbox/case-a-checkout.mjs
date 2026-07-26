import { postCheckout } from './lib.mjs'

const ts = Date.now()
const correlation = `impl12-sbx-a-${ts}`
const payload = {
  product_code: 'WOD-H',
  idempotency_key: `idem-a-${ts}-xxxxxxxx`,
  waiver: {
    document_type: 'SANDBOX_WAIVER',
    version: 'IMPL12-SANDBOX-V1',
    accepted: true,
  },
  correlation_id: correlation,
  buyer: { public_ref: `buyer-sbx-a-${ts}` },
  participant: { public_ref: `part-sbx-a-${ts}` },
}

const result = await postCheckout(payload)
const safe = {
  case: 'A_CHECKOUT',
  correlation_id: correlation,
  http_status: result.status,
  body: result.body,
}
console.log(JSON.stringify(safe, null, 2))
process.exit(result.status >= 200 && result.status < 300 ? 0 : 1)
