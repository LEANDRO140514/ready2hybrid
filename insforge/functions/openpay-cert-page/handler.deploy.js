// insforge/functions/_shared/openpay-cert/harness.ts
var CERT_APP_HOST = "f4rbwhth.us-east.insforge.app";
function sandboxEnabled(env) {
  return env.enabled === "true" && env.sandbox === "true";
}
function redirectAllowed(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === CERT_APP_HOST && url.pathname === "/functions/openpay-cert-page";
  } catch {
    return false;
  }
}
function merchantReady(env) {
  return sandboxEnabled(env) && /^[A-Za-z0-9]{10,40}$/.test(env.merchantId ?? "") && (env.privateKey ?? "").startsWith("sk_") && redirectAllowed(env.redirectUrl);
}
function publicReady(env) {
  return merchantReady(env) && (env.publicKey ?? "").startsWith("pk_");
}
function renderCertPage(env) {
  if (!sandboxEnabled(env)) {
    return new Response("Certificaci\xF3n no disponible.", { status: 404, headers: { "cache-control": "no-store" } });
  }
  if (!publicReady(env)) {
    return new Response("Falta la configuraci\xF3n de certificaci\xF3n en el sandbox.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const config = JSON.stringify({
    merchantId: env.merchantId,
    publicKey: env.publicKey,
    createUrl: "/functions/openpay-cert-create-charge",
    verifyUrl: "/functions/openpay-cert-verify-charge"
  }).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Certificaci\xF3n Openpay \u2014 Hybrid Event</title>
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
  <h1>Certificaci\xF3n Openpay</h1>
  <p>Harness de sandbox para Hybrid Event. No es el checkout del evento.</p>
  <p id="result">Listo para tokenizar.</p>
  <form id="cert-form" autocomplete="off">
    <label>Monto MXN <input id="amount" type="number" min="1" max="150000" step="0.01" value="100" required></label>
    <label><input type="radio" name="installments" value="1" checked> Una sola exhibici\xF3n</label>
    <label><input id="msi3" type="radio" name="installments" value="3"> 3 MSI (desde MXN 300)</label>
    <label>Titular <input data-openpay-card="holder_name" autocomplete="off" required></label>
    <label>Tarjeta <input data-openpay-card="card_number" inputmode="numeric" autocomplete="off" required></label>
    <label>Mes <input data-openpay-card="expiration_month" inputmode="numeric" autocomplete="off" required></label>
    <label>A\xF1o <input data-openpay-card="expiration_year" inputmode="numeric" autocomplete="off" required></label>
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
        show(description || 'Openpay no tokeniz\xF3 la tarjeta.')
      })
    })
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

// insforge/functions/openpay-cert-page/index.ts
function certEnv() {
  return {
    enabled: Deno.env.get("OPENPAY_ENABLED"),
    sandbox: Deno.env.get("OPENPAY_SANDBOX"),
    merchantId: Deno.env.get("OPENPAY_MERCHANT_ID"),
    privateKey: Deno.env.get("OPENPAY_PRIVATE_KEY"),
    publicKey: Deno.env.get("OPENPAY_PUBLIC_KEY"),
    webhookUser: Deno.env.get("OPENPAY_WEBHOOK_USER"),
    webhookPassword: Deno.env.get("OPENPAY_WEBHOOK_PASSWORD"),
    redirectUrl: Deno.env.get("OPENPAY_REDIRECT_URL")
  };
}
function handler() {
  return renderCertPage(certEnv());
}
export {
  handler as default
};
