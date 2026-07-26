import { loadEnvFile, postWebhook, workspaceEnvPath } from './lib.mjs'

const env = loadEnvFile(workspaceEnvPath())
const secret = env.MERCADOPAGO_WEBHOOK_SECRET
if (!secret) {
  console.error('MISSING_MERCADOPAGO_WEBHOOK_SECRET')
  process.exit(2)
}

const dataId = `impl12-nonexistent-${Date.now()}`
const result = await postWebhook({ secret, dataId })
console.log(
  JSON.stringify(
    {
      case: 'PRE_WEBHOOK_NONEXISTENT',
      data_id_kind: 'synthetic_nonexistent',
      http_status: result.status,
      body: result.body,
      request_id: result.requestId,
      expected: 'signature accepted then PAYMENT_NOT_FOUND / no domain writes',
    },
    null,
    2,
  ),
)
process.exit(result.status === 404 || (result.body && result.body.error && result.body.error.code === 'PAYMENT_NOT_FOUND') ? 0 : 1)
