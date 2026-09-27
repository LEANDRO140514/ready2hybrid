// insforge/functions/_shared/openpay-cert/harness.ts
var OPENPAY_SANDBOX_API = "https://sandbox-api.openpay.mx";
var CERT_APP_HOST = "f4rbwhth.us-east.insforge.app";
var CERT_DESCRIPTION = "Hybrid Event Openpay Certification";
var CERT_MAX_MXN = 15e4;
var CERT_MSI_MIN_MXN = 300;
var CERT_CUSTOMER = {
  name: "Sandbox",
  last_name: "Certification",
  phone_number: "5550000000",
  email: "openpay-certification@example.invalid"
};
var CARD_KEYS = /* @__PURE__ */ new Set(["card_number", "cvv", "cvv2", "pan", "card"]);
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
function trustedClientIp(headers) {
  const ipv4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const ipv6 = /^[0-9a-f:]+$/i;
  for (const name of ["cf-connecting-ip", "x-real-ip"]) {
    const value = headers.get(name)?.trim() ?? "";
    if (ipv4.test(value) || value.includes(":") && ipv6.test(value) && value.length <= 45) {
      return value;
    }
  }
  return null;
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
function rejectCardPayload(value) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => CARD_KEYS.has(key.toLowerCase()));
}
function parseAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-6) return null;
  return cents / 100;
}
function certOrderId() {
  return `cert${crypto.randomUUID().replace(/-/g, "")}`;
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
function buildCertCharge(input) {
  if (!/^[A-Za-z0-9]{1,45}$/.test(input.token)) return { ok: false, code: "MISSING_TOKEN" };
  if (!/^[A-Za-z0-9]{32}$/.test(input.deviceSessionId)) return { ok: false, code: "MISSING_DEVICE" };
  if (!(input.amount > 0)) return { ok: false, code: "AMOUNT_INVALID" };
  if (input.amount > CERT_MAX_MXN) return { ok: false, code: "AMOUNT_ABOVE_LIMIT" };
  if (input.installments !== 1 && input.installments !== 3) return { ok: false, code: "MSI_NOT_OFFERED" };
  if (input.installments === 3 && input.amount < CERT_MSI_MIN_MXN) {
    return { ok: false, code: "MSI_BELOW_MINIMUM" };
  }
  if (!redirectAllowed(input.redirectUrl)) return { ok: false, code: "MISCONFIGURED" };
  const body = {
    method: "card",
    source_id: input.token,
    amount: input.amount,
    currency: "MXN",
    description: CERT_DESCRIPTION,
    order_id: input.orderId,
    device_session_id: input.deviceSessionId,
    customer: CERT_CUSTOMER,
    use_3d_secure: true,
    redirect_url: input.redirectUrl
  };
  if (input.installments === 3) body.payment_plan = { payments: 3 };
  return { ok: true, body };
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
async function handleCertCreate(request, env, fetchImpl) {
  if (request.method === "OPTIONS") return json(204, {});
  if (!sandboxEnabled(env)) return json(404, { code: "OPENPAY_DISABLED" });
  if (request.method !== "POST") return json(405, { code: "METHOD" });
  if (!merchantReady(env)) return json(503, { code: "MISCONFIGURED" });
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { code: "INVALID_JSON" });
  }
  if (rejectCardPayload(payload)) return json(400, { code: "CARD_DATA_REJECTED" });
  const body = payload;
  const amount = parseAmount(body.amount);
  const installments = body.installments;
  if (amount === null) return json(400, { code: "AMOUNT_INVALID" });
  if (typeof installments !== "number" || !Number.isInteger(installments)) {
    return json(400, { code: "MSI_NOT_OFFERED" });
  }
  const built = buildCertCharge({
    token: typeof body.token === "string" ? body.token : "",
    deviceSessionId: typeof body.device_session_id === "string" ? body.device_session_id : "",
    amount,
    installments,
    orderId: certOrderId(),
    redirectUrl: env.redirectUrl ?? ""
  });
  if (!built.ok) return json(400, { code: built.code });
  const clientIp = trustedClientIp(request.headers);
  if (!clientIp) return json(400, { code: "MISSING_CLIENT_IP" });
  let response;
  try {
    response = await openpayFetch(
      env,
      "/charges",
      {
        method: "POST",
        body: JSON.stringify(built.body),
        headers: { "x-forwarded-for": clientIp },
        signal: AbortSignal.timeout(2e4)
      },
      fetchImpl
    );
  } catch {
    return json(504, { code: "PROVIDER_UNKNOWN", display: "UNCONFIRMED" });
  }
  const raw = await response.json().catch(() => null);
  if (!response.ok || !raw || typeof raw.id !== "string") {
    const description = raw && typeof raw.description === "string" ? raw.description : null;
    return json(response.status || 502, {
      code: "PROVIDER_REJECTED",
      display: "DECLINED",
      buyer_message: description || "Openpay no cre\xF3 el cargo."
    });
  }
  return json(200, publicChargeView(raw));
}

// insforge/functions/openpay-cert-create-charge/index.ts
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
  return handleCertCreate(request, certEnv(), fetch);
}
export {
  handler as default
};
