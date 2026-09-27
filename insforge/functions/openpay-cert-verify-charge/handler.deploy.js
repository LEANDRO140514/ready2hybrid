// insforge/functions/_shared/openpay-cert/harness.ts
var OPENPAY_SANDBOX_API = "https://sandbox-api.openpay.mx";
var CERT_APP_HOST = "f4rbwhth.us-east.insforge.app";
function sandboxEnabled(env) {
  return env.enabled === "true" && env.sandbox === "true";
}
function displayStatus(status) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return "APPROVED";
  if (normalized === "failed") return "DECLINED";
  if (normalized === "in_progress" || normalized === "charge_pending") return "PENDING";
  return "UNCONFIRMED";
}
function buyerMessage(display, errorMessage) {
  if (display === "APPROVED") return "Pago aprobado.";
  if (display === "DECLINED") return errorMessage || "El banco rechaz\xF3 el cargo.";
  if (display === "PENDING") return "Verificando pago... Openpay a\xFAn no confirma el cargo.";
  return "Verificando pago... Openpay no devolvi\xF3 un estado confirmado.";
}
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": `https://${CERT_APP_HOST}`,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "cache-control": "no-store"
    }
  });
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
function publicChargeView(charge) {
  const status = typeof charge.status === "string" ? charge.status : "";
  const display = displayStatus(status);
  const errorMessage = typeof charge.error_message === "string" ? charge.error_message : null;
  const method = charge.payment_method;
  let redirectUrl = null;
  if (method && typeof method === "object" && method !== null && "url" in method) {
    const url = method.url;
    if (typeof url === "string" && url.startsWith(`${OPENPAY_SANDBOX_API}/`)) redirectUrl = url;
  }
  return {
    id: typeof charge.id === "string" ? charge.id : null,
    order_id: typeof charge.order_id === "string" ? charge.order_id : null,
    status,
    display,
    error_message: errorMessage,
    buyer_message: buyerMessage(display, errorMessage),
    redirect_url: redirectUrl
  };
}
async function openpayFetch(env, path, init, fetchImpl) {
  const merchantId = env.merchantId ?? "";
  const url = `${OPENPAY_SANDBOX_API}/v1/${merchantId}${path}`;
  if (!url.startsWith(`${OPENPAY_SANDBOX_API}/v1/`)) {
    return new Response("bad host", { status: 500 });
  }
  const auth = btoa(`${env.privateKey}:`);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Basic ${auth}`);
  headers.set("content-type", "application/json");
  return fetchImpl(url, { ...init, headers });
}
async function handleCertVerify(request, env, fetchImpl) {
  if (request.method === "OPTIONS") return json(204, {});
  if (!sandboxEnabled(env)) return json(404, { code: "OPENPAY_DISABLED" });
  if (request.method !== "GET" && request.method !== "POST") return json(405, { code: "METHOD" });
  if (!merchantReady(env)) return json(503, { code: "MISCONFIGURED" });
  const url = new URL(request.url);
  let transactionId = url.searchParams.get("id") ?? "";
  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    if (payload && typeof payload.id === "string") transactionId = payload.id;
  }
  if (!/^[a-z0-9]{10,40}$/.test(transactionId)) return json(400, { code: "MISSING_CHARGE" });
  let response;
  try {
    response = await openpayFetch(
      env,
      `/charges/${transactionId}`,
      { method: "GET", signal: AbortSignal.timeout(2e4) },
      fetchImpl
    );
  } catch {
    return json(504, { code: "PROVIDER_UNKNOWN", display: "UNCONFIRMED", buyer_message: "Verificando pago..." });
  }
  const raw = await response.json().catch(() => null);
  if (!response.ok || !raw) {
    return json(502, { code: "PROVIDER_UNKNOWN", display: "UNCONFIRMED", buyer_message: "Verificando pago..." });
  }
  return json(200, publicChargeView(raw));
}

// insforge/functions/openpay-cert-verify-charge/index.ts
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
function handler(request) {
  return handleCertVerify(request, certEnv(), fetch);
}
export {
  handler as default
};
