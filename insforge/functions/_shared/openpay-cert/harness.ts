/**
 * Isolated Openpay certification harness.
 * Not the production checkout and not the dual-provider payment core.
 */

export const OPENPAY_SANDBOX_API = 'https://sandbox-api.openpay.mx'
export const CERT_APP_HOST = 'f4rbwhth.us-east.insforge.app'
export const CERT_DESCRIPTION = 'Hybrid Event Openpay Certification'
export const CERT_MAX_MXN = 150_000
export const CERT_MSI_MIN_MXN = 300

export const CERT_CUSTOMER = {
  name: 'Sandbox',
  last_name: 'Certification',
  phone_number: '5550000000',
  email: 'openpay-certification@example.invalid',
} as const

export const CERT_CHARGE_EVENTS = [
  'charge.created',
  'charge.succeeded',
  'charge.failed',
  'charge.cancelled',
  'charge.refunded',
  'chargeback.created',
  'chargeback.rejected',
  'chargeback.accepted',
] as const

const CARD_KEYS = new Set(['card_number', 'cvv', 'cvv2', 'pan', 'card'])

export type CertEnv = {
  enabled: string | undefined
  sandbox: string | undefined
  merchantId: string | undefined
  privateKey: string | undefined
  publicKey: string | undefined
  webhookUser: string | undefined
  webhookPassword: string | undefined
  redirectUrl: string | undefined
}

export type CertDisplay = 'APPROVED' | 'DECLINED' | 'PENDING' | 'UNCONFIRMED'

export function sandboxEnabled(env: CertEnv): boolean {
  return env.enabled === 'true' && env.sandbox === 'true'
}

export function displayStatus(status: string): CertDisplay {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'completed') return 'APPROVED'
  if (normalized === 'failed') return 'DECLINED'
  if (normalized === 'in_progress' || normalized === 'charge_pending') return 'PENDING'
  return 'UNCONFIRMED'
}

export function buyerMessage(display: CertDisplay, errorMessage: string | null): string {
  if (display === 'APPROVED') return 'Pago aprobado.'
  if (display === 'DECLINED') return errorMessage || 'El banco rechazó el cargo.'
  if (display === 'PENDING') return 'Verificando pago... Openpay aún no confirma el cargo.'
  return 'Verificando pago... Openpay no devolvió un estado confirmado.'
}

export function trustedClientIp(headers: Headers): string | null {
  const ipv4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
  const ipv6 = /^[0-9a-f:]+$/i
  for (const name of ['cf-connecting-ip', 'x-real-ip']) {
    const value = headers.get(name)?.trim() ?? ''
    if (ipv4.test(value) || (value.includes(':') && ipv6.test(value) && value.length <= 45)) {
      return value
    }
  }
  return null
}

export function sameSecret(left: string, right: string): boolean {
  const encodedLeft = new TextEncoder().encode(left)
  const encodedRight = new TextEncoder().encode(right)
  const length = Math.max(encodedLeft.length, encodedRight.length)
  let diff = encodedLeft.length ^ encodedRight.length
  for (let index = 0; index < length; index += 1) {
    diff |= (encodedLeft[index] ?? 0) ^ (encodedRight[index] ?? 0)
  }
  return diff === 0
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': `https://${CERT_APP_HOST}`,
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'cache-control': 'no-store',
    },
  })
}

function rejectCardPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  return Object.keys(value as Record<string, unknown>).some((key) => CARD_KEYS.has(key.toLowerCase()))
}

function parseAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const cents = Math.round(value * 100)
  if (Math.abs(value * 100 - cents) > 1e-6) return null
  return cents / 100
}

export function certOrderId(): string {
  return `cert${crypto.randomUUID().replace(/-/g, '')}`
}

export function redirectAllowed(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === CERT_APP_HOST &&
      url.pathname === '/functions/openpay-cert-page'
    )
  } catch {
    return false
  }
}

export function buildCertCharge(input: {
  token: string
  deviceSessionId: string
  amount: number
  installments: number
  orderId: string
  redirectUrl: string
}): { ok: true; body: Record<string, unknown> } | { ok: false; code: string } {
  if (!/^[A-Za-z0-9]{1,45}$/.test(input.token)) return { ok: false, code: 'MISSING_TOKEN' }
  if (!/^[A-Za-z0-9]{32}$/.test(input.deviceSessionId)) return { ok: false, code: 'MISSING_DEVICE' }
  if (!(input.amount > 0)) return { ok: false, code: 'AMOUNT_INVALID' }
  if (input.amount > CERT_MAX_MXN) return { ok: false, code: 'AMOUNT_ABOVE_LIMIT' }
  if (input.installments !== 1 && input.installments !== 3) return { ok: false, code: 'MSI_NOT_OFFERED' }
  if (input.installments === 3 && input.amount < CERT_MSI_MIN_MXN) {
    return { ok: false, code: 'MSI_BELOW_MINIMUM' }
  }
  if (!redirectAllowed(input.redirectUrl)) return { ok: false, code: 'MISCONFIGURED' }

  const body: Record<string, unknown> = {
    method: 'card',
    source_id: input.token,
    amount: input.amount,
    currency: 'MXN',
    description: CERT_DESCRIPTION,
    order_id: input.orderId,
    device_session_id: input.deviceSessionId,
    customer: CERT_CUSTOMER,
    use_3d_secure: true,
    redirect_url: input.redirectUrl,
  }
  if (input.installments === 3) body.payment_plan = { payments: 3 }
  return { ok: true, body }
}

function merchantReady(env: CertEnv): boolean {
  return (
    sandboxEnabled(env) &&
    /^[A-Za-z0-9]{10,40}$/.test(env.merchantId ?? '') &&
    (env.privateKey ?? '').startsWith('sk_') &&
    redirectAllowed(env.redirectUrl)
  )
}

function publicReady(env: CertEnv): boolean {
  return merchantReady(env) && (env.publicKey ?? '').startsWith('pk_')
}

export function publicChargeView(charge: Record<string, unknown>) {
  const status = typeof charge.status === 'string' ? charge.status : ''
  const display = displayStatus(status)
  const errorMessage = typeof charge.error_message === 'string' ? charge.error_message : null
  const method = charge.payment_method
  let redirectUrl: string | null = null
  if (method && typeof method === 'object' && method !== null && 'url' in method) {
    const url = (method as { url?: unknown }).url
    if (typeof url === 'string' && url.startsWith(`${OPENPAY_SANDBOX_API}/`)) redirectUrl = url
  }
  return {
    id: typeof charge.id === 'string' ? charge.id : null,
    order_id: typeof charge.order_id === 'string' ? charge.order_id : null,
    status,
    display,
    error_message: errorMessage,
    buyer_message: buyerMessage(display, errorMessage),
    redirect_url: redirectUrl,
  }
}

async function openpayFetch(
  env: CertEnv,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const merchantId = env.merchantId ?? ''
  const url = `${OPENPAY_SANDBOX_API}/v1/${merchantId}${path}`
  if (!url.startsWith(`${OPENPAY_SANDBOX_API}/v1/`)) {
    return new Response('bad host', { status: 500 })
  }
  const auth = btoa(`${env.privateKey}:`)
  const headers = new Headers(init.headers)
  headers.set('authorization', `Basic ${auth}`)
  headers.set('content-type', 'application/json')
  return fetchImpl(url, { ...init, headers })
}

export async function handleCertCreate(
  request: Request,
  env: CertEnv,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (request.method === 'OPTIONS') return json(204, {})
  if (!sandboxEnabled(env)) return json(404, { code: 'OPENPAY_DISABLED' })
  if (request.method !== 'POST') return json(405, { code: 'METHOD' })
  if (!merchantReady(env)) return json(503, { code: 'MISCONFIGURED' })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json(400, { code: 'INVALID_JSON' })
  }
  if (rejectCardPayload(payload)) return json(400, { code: 'CARD_DATA_REJECTED' })
  const body = payload as Record<string, unknown>
  const amount = parseAmount(body.amount)
  const installments = body.installments
  if (amount === null) return json(400, { code: 'AMOUNT_INVALID' })
  if (typeof installments !== 'number' || !Number.isInteger(installments)) {
    return json(400, { code: 'MSI_NOT_OFFERED' })
  }
  const built = buildCertCharge({
    token: typeof body.token === 'string' ? body.token : '',
    deviceSessionId: typeof body.device_session_id === 'string' ? body.device_session_id : '',
    amount,
    installments,
    orderId: certOrderId(),
    redirectUrl: env.redirectUrl ?? '',
  })
  if (!built.ok) return json(400, { code: built.code })

  const clientIp = trustedClientIp(request.headers)
  if (!clientIp) return json(400, { code: 'MISSING_CLIENT_IP' })

  let response: Response
  try {
    response = await openpayFetch(
      env,
      '/charges',
      {
        method: 'POST',
        body: JSON.stringify(built.body),
        headers: { 'x-forwarded-for': clientIp },
        signal: AbortSignal.timeout(20_000),
      },
      fetchImpl,
    )
  } catch {
    return json(504, { code: 'PROVIDER_UNKNOWN', display: 'UNCONFIRMED' })
  }

  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !raw || typeof raw.id !== 'string') {
    const description = raw && typeof raw.description === 'string' ? raw.description : null
    return json(response.status || 502, {
      code: 'PROVIDER_REJECTED',
      display: 'DECLINED',
      buyer_message: description || 'Openpay no creó el cargo.',
    })
  }
  return json(200, publicChargeView(raw))
}

export async function handleCertVerify(
  request: Request,
  env: CertEnv,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (request.method === 'OPTIONS') return json(204, {})
  if (!sandboxEnabled(env)) return json(404, { code: 'OPENPAY_DISABLED' })
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { code: 'METHOD' })
  if (!merchantReady(env)) return json(503, { code: 'MISCONFIGURED' })

  const url = new URL(request.url)
  let transactionId = url.searchParams.get('id') ?? ''
  if (request.method === 'POST') {
    const payload = (await request.json().catch(() => null)) as { id?: unknown } | null
    if (payload && typeof payload.id === 'string') transactionId = payload.id
  }
  if (!/^[a-z0-9]{10,40}$/.test(transactionId)) return json(400, { code: 'MISSING_CHARGE' })

  let response: Response
  try {
    response = await openpayFetch(
      env,
      `/charges/${transactionId}`,
      { method: 'GET', signal: AbortSignal.timeout(20_000) },
      fetchImpl,
    )
  } catch {
    return json(504, { code: 'PROVIDER_UNKNOWN', display: 'UNCONFIRMED', buyer_message: 'Verificando pago...' })
  }
  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !raw) {
    return json(502, { code: 'PROVIDER_UNKNOWN', display: 'UNCONFIRMED', buyer_message: 'Verificando pago...' })
  }
  return json(200, publicChargeView(raw))
}

function basicCredentials(request: Request): { user: string; password: string } | null {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return null
  try {
    const decoded = atob(header.slice(6))
    const split = decoded.indexOf(':')
    if (split < 0) return null
    return { user: decoded.slice(0, split), password: decoded.slice(split + 1) }
  } catch {
    return null
  }
}

export async function handleCertWebhook(
  request: Request,
  env: CertEnv,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (!sandboxEnabled(env)) return json(404, { code: 'OPENPAY_DISABLED' })
  if (request.method !== 'POST') return json(405, { code: 'METHOD' })
  if (!merchantReady(env) || !env.webhookUser || !env.webhookPassword) {
    return json(503, { code: 'MISCONFIGURED' })
  }
  const credentials = basicCredentials(request)
  if (
    !credentials ||
    !sameSecret(credentials.user, env.webhookUser) ||
    !sameSecret(credentials.password, env.webhookPassword)
  ) {
    return json(401, { code: 'UNAUTHORIZED' })
  }

  const payload = (await request.json().catch(() => null)) as {
    type?: unknown
    transaction?: { id?: unknown }
  } | null
  const type = payload && typeof payload.type === 'string' ? payload.type : ''
  if (type === 'verification') return json(200, { received: true })
  if (!(CERT_CHARGE_EVENTS as readonly string[]).includes(type)) {
    return json(200, { received: true, ignored: true })
  }

  const transactionId = payload?.transaction?.id
  if (typeof transactionId !== 'string' || !/^[a-z0-9]{10,40}$/.test(transactionId)) {
    return json(400, { code: 'MISSING_CHARGE' })
  }

  let response: Response
  try {
    response = await openpayFetch(
      env,
      `/charges/${transactionId}`,
      { method: 'GET', signal: AbortSignal.timeout(20_000) },
      fetchImpl,
    )
  } catch {
    return json(502, { code: 'PROVIDER_UNKNOWN' })
  }
  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !raw) return json(502, { code: 'PROVIDER_UNKNOWN' })
  const view = publicChargeView(raw)
  return json(200, { received: true, id: view.id, display: view.display, status: view.status })
}

export function renderCertPage(env: CertEnv): Response {
  if (!sandboxEnabled(env)) {
    return new Response('Certificación no disponible.', { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  if (!publicReady(env)) {
    return new Response('Falta la configuración de certificación en el sandbox.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  const config = JSON.stringify({
    merchantId: env.merchantId,
    publicKey: env.publicKey,
    createUrl: '/functions/openpay-cert-create-charge',
    verifyUrl: '/functions/openpay-cert-verify-charge',
  }).replace(/</g, '\\u003c')

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Certificación Openpay — Hybrid Event</title>
  <script src="https://js.openpay.mx/openpay.v1.min.js"></script>
  <script src="https://js.openpay.mx/openpay-data.v1.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 36rem; line-height: 1.4; }
    label { display: block; margin: 0.75rem 0 0.25rem; }
    input, button { font: inherit; }
    button { margin-top: 1rem; padding: 0.6rem 1rem; }
    #result { margin-top: 1rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Certificación Openpay</h1>
  <p>Harness de sandbox para Hybrid Event. No es el checkout del evento.</p>
  <p id="result">Listo para tokenizar.</p>
  <form id="cert-form" autocomplete="off">
    <label>Monto MXN <input id="amount" type="number" min="1" max="150000" step="0.01" value="100" required></label>
    <label><input type="radio" name="installments" value="1" checked> Una sola exhibición</label>
    <label><input id="msi3" type="radio" name="installments" value="3"> 3 MSI (desde MXN 300)</label>
    <label>Titular <input data-openpay-card="holder_name" autocomplete="off" required></label>
    <label>Tarjeta <input data-openpay-card="card_number" inputmode="numeric" autocomplete="off" required></label>
    <label>Mes <input data-openpay-card="expiration_month" inputmode="numeric" autocomplete="off" required></label>
    <label>Año <input data-openpay-card="expiration_year" inputmode="numeric" autocomplete="off" required></label>
    <label>CVV <input data-openpay-card="cvv2" inputmode="numeric" autocomplete="off" required></label>
    <button id="pay" type="submit">Crear cargo sandbox</button>
  </form>
  <script id="cert-config" type="application/json">${config}</script>
  <script>
    const config = JSON.parse(document.getElementById('cert-config').textContent)
    const result = document.getElementById('result')
    const amountInput = document.getElementById('amount')
    const msi3 = document.getElementById('msi3')
    function show(text) { result.textContent = text }
    function syncMsi() {
      const amount = Number(amountInput.value)
      const allowed = amount >= 300
      msi3.disabled = !allowed
      if (!allowed && msi3.checked) document.querySelector('input[value="1"]').checked = true
    }
    amountInput.addEventListener('input', syncMsi)
    syncMsi()
    OpenPay.setId(config.merchantId)
    OpenPay.setApiKey(config.publicKey)
    OpenPay.setSandboxMode(true)
    const deviceSessionId = OpenPay.deviceData.setup()
    const params = new URLSearchParams(location.search)
    const returningId = params.get('id')
    if (returningId) {
      show('Verificando pago...')
      fetch(config.verifyUrl + '?id=' + encodeURIComponent(returningId))
        .then((response) => response.json())
        .then((body) => show((body.buyer_message || 'Verificando pago...') + '\\n' + (body.display || 'UNCONFIRMED')))
        .catch(() => show('Verificando pago...'))
    }
    document.getElementById('cert-form').addEventListener('submit', (event) => {
      event.preventDefault()
      show('Tokenizando en Openpay...')
      OpenPay.token.extractFormAndCreate('cert-form', (response) => {
        const token = response && response.data && response.data.id
        const installments = Number(document.querySelector('input[name="installments"]:checked').value)
        fetch(config.createUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: token,
            device_session_id: deviceSessionId,
            amount: Number(amountInput.value),
            installments: installments
          })
        }).then((res) => res.json()).then((body) => {
          if (body.redirect_url) {
            show('Verificando pago...')
            location.assign(body.redirect_url)
            return
          }
          show((body.buyer_message || body.code || 'Sin estado') + '\\n' + (body.display || ''))
        }).catch(() => show('No se pudo crear el cargo.'))
      }, (response) => {
        const description = response && response.data && response.data.description
        show(description || 'Openpay no tokenizó la tarjeta.')
      })
    })
  </script>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
