// insforge/functions/openpay-e2e-page/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/openpay/return-status.ts
var FAILED_ORDER = /* @__PURE__ */ new Set(["REJECTED", "CANCELLED", "EXPIRED"]);
var OPEN_ORDER = /* @__PURE__ */ new Set(["CREATED", "PREFERENCE_PENDING", "PAYMENT_PENDING"]);
var FAILED_ATTEMPT = /* @__PURE__ */ new Set(["failed", "FAILED", "cancelled", "CANCELLED", "REJECTED"]);
function sandboxReturnOutcome(input) {
  if (!input.orderState) return "unknown";
  if (input.orderState === "PAID") return "approved";
  if (FAILED_ORDER.has(input.orderState)) return "failed";
  if (input.providerErrorCode || input.attemptStatus != null && FAILED_ATTEMPT.has(input.attemptStatus)) {
    return "failed";
  }
  if (OPEN_ORDER.has(input.orderState)) return "pending";
  return "unknown";
}

// insforge/functions/openpay-e2e-page/index.ts
var RESERVED_ORDER_ID = "7d65fb36-46fd-444c-aed8-7f1ec8d00b18";
var CREATE_PATH = "/functions/openpay-create-charge";
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function html(status, body) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
function outcomePage(outcome, errorCode) {
  const title = {
    approved: "Pago aprobado",
    pending: "Pago pendiente",
    failed: "Pago no completado",
    unknown: "Sin resultado"
  }[outcome];
  const detail = {
    approved: "La inscripci\xF3n qued\xF3 registrada. No se inici\xF3 otro cargo.",
    pending: "Seguimos esperando la confirmaci\xF3n. No se inici\xF3 otro cargo.",
    failed: errorCode ? `Openpay rechaz\xF3 el pago (${errorCode}). No se inici\xF3 otro cargo.` : "Openpay no complet\xF3 el pago. No se inici\xF3 otro cargo.",
    unknown: "No hay una orden de esta prueba para consultar."
  }[outcome];
  return html(200, `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body { margin: 0; background: #fff; color: #111; font-family: system-ui, sans-serif; line-height: 1.45; }
    main { max-width: 36rem; margin: 0 auto; padding: 1.25rem; }
    h1 { font-size: 1.4rem; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${detail}</p>
  </main>
</body>
</html>`);
}
function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : null;
}
async function handler(req) {
  if (req.method !== "GET") return html(405, "M\xE9todo no permitido.");
  const url = new URL(req.url);
  const returning = url.search.length > 0;
  if (env("OPENPAY_ENABLED") !== "true" || env("OPENPAY_SANDBOX") !== "true") {
    return html(404, "Openpay sandbox no est\xE1 habilitado.");
  }
  const merchantId = env("OPENPAY_MERCHANT_ID") ?? "";
  const publicKey = env("OPENPAY_PUBLIC_KEY") ?? "";
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!merchantId || !publicKey.startsWith("pk_") || !baseUrl || !apiKey) {
    return html(503, "Falta la configuraci\xF3n p\xFAblica de Openpay en el sandbox.");
  }
  if (!RESERVED_ORDER_ID) {
    if (returning) return outcomePage("unknown", null);
    return html(200, `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prueba Openpay sandbox</title>
</head>
<body>
  <main>
    <h1>Prueba THREE_MSI en sandbox</h1>
    <p>Sandbox \xB7 HALF-IND-H \xB7 MXN 900 \xB7 3 meses sin intereses.</p>
    <p>La p\xE1gina est\xE1 lista. No hay una orden abierta.</p>
  </main>
</body>
</html>`);
  }
  const admin = createAdminClient({ baseUrl, apiKey });
  const { data, error } = await admin.database.from("orders").select("id,state,currency,total_cents").eq("id", RESERVED_ORDER_ID).limit(1);
  const { data: holdData } = await admin.database.from("capacity_holds").select("state,expires_at").eq("order_id", RESERVED_ORDER_ID).limit(1);
  const { data: attemptData } = await admin.database.from("openpay_payment_attempts").select("last_verified_status,provider_error_code").eq("order_id", RESERVED_ORDER_ID).limit(1);
  const order = firstRow(data);
  const hold = firstRow(holdData);
  const attempt = firstRow(attemptData);
  if (returning) {
    const errorCode = attempt?.provider_error_code && /^[0-9]{1,6}$/.test(attempt.provider_error_code) ? attempt.provider_error_code : null;
    return outcomePage(sandboxReturnOutcome({
      orderState: error || !order ? null : order.state,
      attemptStatus: attempt?.last_verified_status ?? null,
      providerErrorCode: errorCode
    }), errorCode);
  }
  const totalCents = order ? Number(order.total_cents) : NaN;
  const holdOpen = hold?.state === "ACTIVE" && hold.expires_at != null && Date.parse(hold.expires_at) > Date.now();
  const ready = !error && order?.state === "PREFERENCE_PENDING" && order.currency === "MXN" && totalCents === 9e4 && holdOpen;
  if (!ready) {
    return html(409, "El pedido reservado no est\xE1 listo para la prueba. No se reinici\xF3.");
  }
  const config = JSON.stringify({
    merchantId,
    publicKey,
    createUrl: CREATE_PATH,
    orderId: RESERVED_ORDER_ID
  }).replace(/</g, "\\u003c");
  return html(200, `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prueba Openpay sandbox</title>
  <script src="https://js.openpay.mx/openpay.v1.min.js"></script>
  <script src="https://js.openpay.mx/openpay-data.v1.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body { margin: 0; background: #fff; color: #111; font-family: system-ui, sans-serif; line-height: 1.45; overflow-x: hidden; }
    main { max-width: 36rem; margin: 0 auto; padding: 1.25rem; }
    h1 { font-size: 1.4rem; }
    label { display: block; margin: 0.85rem 0 0.3rem; }
    input[type="radio"] { width: auto; }
    input { width: 100%; font: inherit; padding: 0.55rem; background: #fff; color: #111; border: 1px solid #111; }
    button { width: 100%; margin-top: 1rem; min-height: 44px; font: inherit; background: #111; color: #fff; border: 0; }
    #status { margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>Prueba Openpay sandbox</h1>
    <p>Sandbox \xB7 HALF-IND-H \xB7 MXN 900 \xB7 prueba 3 meses</p>
    <p id="device">Preparando dispositivo\u2026</p>
    <form id="pay-form" autocomplete="off">
      <label><input type="radio" name="mode" value="ONE_TIME"> Pago de contado</label>
      <label><input type="radio" name="mode" value="THREE_MSI" checked> 3 meses sin intereses</label>
      <label>Titular <input data-openpay-card="holder_name" autocomplete="off" required></label>
      <label>Tarjeta <input data-openpay-card="card_number" inputmode="numeric" autocomplete="off" required></label>
      <label>Mes <input data-openpay-card="expiration_month" inputmode="numeric" autocomplete="off" required></label>
      <label>A\xF1o <input data-openpay-card="expiration_year" inputmode="numeric" autocomplete="off" required></label>
      <label>CVV <input data-openpay-card="cvv2" inputmode="numeric" autocomplete="off" required></label>
      <button type="submit">Continuar al pago sandbox</button>
    </form>
    <p id="status"></p>
  </main>
  <script id="e2e-config" type="application/json">${config}</script>
  <script>
    const config = JSON.parse(document.getElementById('e2e-config').textContent)
    const status = document.getElementById('status')
    const device = document.getElementById('device')
    OpenPay.setId(config.merchantId)
    OpenPay.setApiKey(config.publicKey)
    OpenPay.setSandboxMode(true)
    const deviceSessionId = OpenPay.deviceData.setup()
    device.textContent = deviceSessionId ? 'Dispositivo listo' : 'Sin dispositivo'
    document.getElementById('pay-form').addEventListener('submit', (event) => {
      event.preventDefault()
      status.textContent = 'Tokenizando en Openpay\u2026'
      OpenPay.token.extractFormAndCreate('pay-form', (response) => {
        const sourceId = response && response.data && response.data.id
        const mode = document.querySelector('input[name="mode"]:checked').value
        fetch(config.createUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            order_id: config.orderId,
            source_id: sourceId,
            device_session_id: deviceSessionId,
            mode: mode
          })
        }).then((res) => res.json()).then((body) => {
          if (body.redirect_url) {
            status.textContent = 'Estamos verificando tu pago.'
            location.assign(body.redirect_url)
            return
          }
          status.textContent = [body.error, body.error_code, body.description].filter(Boolean).join(' \xB7 ') || body.status || 'Sin cargo.'
        }).catch(() => {
          status.textContent = 'No se pudo continuar.'
        })
      }, () => {
        status.textContent = 'Openpay no tokeniz\xF3 la tarjeta.'
      })
    })
  </script>
</body>
</html>`);
}
export {
  handler as default
};
