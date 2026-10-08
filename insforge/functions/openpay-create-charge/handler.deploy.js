// insforge/functions/openpay-create-charge/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/openpay/msi.ts
var OPENPAY_MAX_CHARGE_CENTS = 15e6;
var OPENPAY_MSI_MIN_CENTS = 3e4;
var OPENPAY_ALLOWED_INSTALLMENTS = [1, 3];
function openpayInstallmentChoice(totalCents, installments) {
  if (!OPENPAY_ALLOWED_INSTALLMENTS.includes(installments)) {
    return { ok: false, code: "MSI_NOT_OFFERED" };
  }
  if (installments === 3 && totalCents < OPENPAY_MSI_MIN_CENTS) {
    return { ok: false, code: "MSI_BELOW_MINIMUM" };
  }
  return { ok: true, installments };
}
function openpayChoicesForAmount(totalCents) {
  if (totalCents >= OPENPAY_MSI_MIN_CENTS) return [1, 3];
  return [1];
}

// insforge/functions/_shared/openpay/charge.ts
function openpayOrderId(attemptId) {
  return `r2h_${attemptId.replace(/-/g, "")}`;
}
function attemptIdFromOpenpayOrderId(orderId) {
  if (!orderId.startsWith("r2h_") || orderId.length !== 36) return null;
  const hex = orderId.slice(4);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function buildOpenpayCharge(draft) {
  const plan = openpayInstallmentChoice(draft.totalCents, draft.installments);
  if (!plan.ok) return plan;
  if (draft.totalCents > OPENPAY_MAX_CHARGE_CENTS) return { ok: false, code: "AMOUNT_ABOVE_LIMIT" };
  if (!draft.sourceId) return { ok: false, code: "MISSING_TOKEN" };
  if (!draft.deviceSessionId) return { ok: false, code: "MISSING_DEVICE" };
  const body = {
    method: "card",
    source_id: draft.sourceId,
    amount: draft.totalCents / 100,
    currency: "MXN",
    description: "Hybrid Event Experience",
    order_id: openpayOrderId(draft.attemptId),
    device_session_id: draft.deviceSessionId,
    use_3d_secure: true,
    redirect_url: draft.redirectUrl
  };
  if (draft.customer) body.customer = draft.customer;
  if (plan.installments === 3) body.payment_plan = { payments: 3 };
  return { ok: true, body };
}

// insforge/functions/_shared/openpay/attempt.ts
var PAYABLE_ORDER_STATES = ["CREATED", "PREFERENCE_PENDING", "PAYMENT_PENDING"];
var BROWSER_AMOUNT_KEYS = ["amount", "amount_cents", "total_cents", "unit_price_cents", "item_total_cents"];
var CARD_KEYS = ["card_number", "cvv", "cvv2", "pan", "card"];
function browserSuppliedAmount(body) {
  return BROWSER_AMOUNT_KEYS.some((key) => key in body && body[key] != null);
}
function browserSuppliedCard(body) {
  return CARD_KEYS.some((key) => key in body);
}
function parsePaymentMode(input) {
  if (input.mode !== "ONE_TIME" && input.mode !== "THREE_MSI") {
    return { ok: false, code: "MODE_NOT_ALLOWED" };
  }
  const installments = input.mode === "THREE_MSI" ? 3 : 1;
  if (input.installments != null && input.installments !== installments) {
    const choice = openpayInstallmentChoice(3e4, Number(input.installments));
    return { ok: false, code: choice.ok ? "MODE_NOT_ALLOWED" : "MSI_NOT_OFFERED" };
  }
  return { ok: true, mode: input.mode, installments };
}
function readCents(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}
function assessOrder(order) {
  if (order.currency !== "MXN") return { ok: false, code: "CURRENCY_MISMATCH" };
  if (!Number.isSafeInteger(order.totalCents) || order.totalCents <= 0) {
    return { ok: false, code: "ORDER_AMOUNT_MISMATCH" };
  }
  if (order.state === "PAID") return { ok: false, code: "ORDER_ALREADY_PAID" };
  if (!PAYABLE_ORDER_STATES.includes(order.state)) {
    return { ok: false, code: "ORDER_NOT_PAYABLE" };
  }
  return { ok: true };
}
function assessHolds(holds, nowIso) {
  const now = Date.parse(nowIso);
  for (const hold of holds) {
    if (hold.state === "CONVERTED") continue;
    const unexpired = hold.expiresAt == null || Date.parse(hold.expiresAt) >= now;
    if (hold.state === "ACTIVE" && unexpired) continue;
    return { ok: false, code: "HOLD_NOT_CONVERTIBLE" };
  }
  return { ok: true };
}
function paymentPathAllowed(payments) {
  if (payments.some((payment) => payment.provider !== "OPENPAY")) {
    return { ok: false, code: "PROVIDER_CONFLICT" };
  }
  return { ok: true };
}
function nextAttemptAction(existing, orderId) {
  if (!existing) return { action: "create_attempt", openpayOrderRef: openpayOrderId(orderId) };
  if (!existing.openpayOrderRef) return { action: "ref_mismatch" };
  if (existing.openpayChargeId) {
    return { action: "reuse_charge", openpayOrderRef: existing.openpayOrderRef, chargeId: existing.openpayChargeId };
  }
  return { action: "create_charge", openpayOrderRef: existing.openpayOrderRef };
}
function failedChargeDisposition(normalized) {
  if (normalized === "REJECTED") return "rotate";
  if (normalized === "CANCELLED") return "stop";
  return "keep";
}
function chargeIdDecision(current, incoming) {
  if (current == null || current === "") return "set";
  if (current === incoming) return "same";
  return "mismatch";
}
function safeTechnicalStatus(status) {
  if (typeof status !== "string") return null;
  const trimmed = status.trim();
  if (!/^[A-Za-z0-9_]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}
var OPENPAY_REDIRECT_HOSTS = /* @__PURE__ */ new Set([
  "https://sandbox-api.openpay.mx",
  "https://api.openpay.mx"
]);
function openpayChargeRedirect(paymentMethod, apiBase) {
  if (!OPENPAY_REDIRECT_HOSTS.has(apiBase)) return null;
  if (!paymentMethod || typeof paymentMethod !== "object" || !("url" in paymentMethod)) return null;
  const url = paymentMethod.url;
  if (typeof url !== "string" || !url.startsWith(`${apiBase}/`)) return null;
  return url;
}
function shouldApplyVerified(normalized) {
  return normalized === "APPROVED";
}
function shouldSendTicketEmail(outcome) {
  return outcome === "PAID";
}
function verifiedApplyPayload(input) {
  return {
    openpay_order_ref: input.openpayOrderRef,
    openpay_charge_id: input.chargeId,
    order_id: input.orderId,
    normalized_state: "APPROVED",
    amount_cents: input.amountCents,
    currency: "MXN",
    verified_at: input.verifiedAt,
    external_state: input.externalState.slice(0, 64),
    correlation_id: input.correlationId.slice(0, 64)
  };
}

// insforge/functions/_shared/openpay/client-ip.ts
var IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
var IPV6 = /^[0-9a-f:]+$/i;
var PLATFORM_SUFFIX_LENGTH = 3;
function ipv4Class(value) {
  if (!IPV4.test(value)) return null;
  const [a, b] = value.split(".").map(Number);
  if (a === 0 || a === 127) return "loopback";
  if (a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168) return "private";
  return "public";
}
function isClientAddress(value) {
  if (ipv4Class(value) === "public") return true;
  if (!value.includes(":") || !IPV6.test(value) || value.length > 45) return false;
  const lower = value.toLowerCase();
  return lower !== "::" && lower !== "::1";
}
function singleUsableAddress(raw) {
  const value = raw?.trim() ?? "";
  if (!value || value.includes(",")) return null;
  return isClientAddress(value) ? value : null;
}
function trustedForwardedFor(raw) {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < PLATFORM_SUFFIX_LENGTH) return null;
  const client = parts[parts.length - 3];
  const hop = parts[parts.length - 2];
  const edge = parts[parts.length - 1];
  if (ipv4Class(hop) !== "private") return null;
  if (ipv4Class(edge) !== "public") return null;
  if (!isClientAddress(client)) return null;
  return client;
}
function trustedClientIp(headers) {
  return trustedForwardedFor(headers.get("x-forwarded-for")) ?? singleUsableAddress(headers.get("cf-connecting-ip")) ?? singleUsableAddress(headers.get("x-real-ip"));
}

// insforge/functions/_shared/openpay/gate.ts
var OPENPAY_SANDBOX_API = "https://sandbox-api.openpay.mx";
var OPENPAY_PRODUCTION_API = "https://api.openpay.mx";
function openpayRuntime(env2) {
  if (env2.OPENPAY_ENABLED !== "true") return null;
  if (env2.OPENPAY_SANDBOX === "true") {
    return { sandbox: true, apiBase: OPENPAY_SANDBOX_API };
  }
  return { sandbox: false, apiBase: OPENPAY_PRODUCTION_API };
}
function openpayMsiEnabled(env2) {
  return env2.OPENPAY_MSI_ENABLED === "true";
}

// insforge/functions/_shared/openpay/status.ts
var CHARGE_STATUS = {
  COMPLETED: "APPROVED",
  IN_PROGRESS: "PENDING",
  CHARGE_PENDING: "PENDING",
  FAILED: "REJECTED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  CHARGEBACK_PENDING: "CHARGED_BACK",
  CHARGEBACK_ACCEPTED: "CHARGED_BACK",
  CHARGEBACK_ADJUSTMENT: "CHARGED_BACK"
};
function normalizeOpenpayChargeStatus(status) {
  if (typeof status !== "string") return "UNKNOWN";
  return CHARGE_STATUS[status.trim().toUpperCase()] ?? "UNKNOWN";
}

// insforge/functions/_shared/openpay/provider-error.ts
var PAN = /\d{12,19}/g;
var EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
var SECRET = /\b(?:sk|pk)_[A-Za-z0-9]+\b/g;
var CHARGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
function sanitizeErrorCode(value) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== "string" || !/^[0-9]{1,6}$/.test(text)) return null;
  return text;
}
function sanitizeProviderDetail(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(PAN, "").replace(EMAIL, "").replace(SECRET, "").replace(/\s+/g, " ").trim().slice(0, 180);
  return cleaned.length > 0 ? cleaned : null;
}
function sanitizeChargeId(value) {
  if (typeof value !== "string" || !CHARGE_ID.test(value)) return null;
  return value;
}
function classifyOpenpayCreateBody(httpStatus, body) {
  const chargeId = sanitizeChargeId(body.id);
  const errorCode = sanitizeErrorCode(body.error_code);
  const description = sanitizeProviderDetail(
    typeof body.description === "string" ? body.description : body.error_message
  );
  if (chargeId) {
    const status = typeof body.status === "string" ? body.status.trim() : null;
    return {
      outcome: "charge",
      chargeId,
      status: status && /^[A-Za-z0-9_]{1,64}$/.test(status) ? status : null,
      errorCode,
      description
    };
  }
  if (httpStatus >= 400 && httpStatus < 500 && errorCode) {
    return { outcome: "business", errorCode, description };
  }
  return { outcome: "technical" };
}
function chargeIsBusinessRejection(status) {
  if (!status) return false;
  return normalizeOpenpayChargeStatus(status) === "REJECTED";
}

// insforge/functions/_shared/openpay/verify.ts
function verifyOpenpayCharge(charge, expected) {
  const orderRef = expected.orderRef ?? (expected.attemptId ? openpayOrderId(expected.attemptId) : null);
  if (!orderRef || charge.order_id !== orderRef) {
    return { ok: false, code: "REFERENCE_MISMATCH" };
  }
  if (charge.currency !== "MXN") return { ok: false, code: "CURRENCY_MISMATCH" };
  const cents = Math.round(charge.amount * 100);
  if (cents !== expected.totalCents) return { ok: false, code: "AMOUNT_MISMATCH" };
  return { ok: true, normalized: normalizeOpenpayChargeStatus(charge.status) };
}

// insforge/functions/_shared/http/origin-guard.ts
var PUBLIC_ORIGIN_NOT_ALLOWED = {
  error: {
    code: "ORIGIN_NOT_ALLOWED",
    message: "Request origin is not allowed.",
    retry: "NO"
  }
};
function normalizeConfiguredOrigin(raw) {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function readConfiguredOrigin(env2, primaryKey, fallbackKey) {
  const primary = normalizeConfiguredOrigin(env2(primaryKey));
  if (primary) return primary;
  if (fallbackKey) return normalizeConfiguredOrigin(env2(fallbackKey));
  return null;
}
function readRequestOrigin(req) {
  const raw = req.headers.get("Origin");
  if (raw == null) return null;
  if (raw === "null") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function buildCorsHeaders(input) {
  return {
    "Access-Control-Allow-Origin": input.allowedOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": input.allowMethods,
    "Access-Control-Allow-Headers": input.allowHeaders,
    ...input.extra ?? {}
  };
}
function gateRequestOrigin(input) {
  if (!input.allowedOrigin) {
    return { ok: false, kind: "MISSING_CONFIG" };
  }
  const requestOrigin = readRequestOrigin(input.req);
  if (requestOrigin == null || requestOrigin !== input.allowedOrigin) {
    return { ok: false, kind: "ORIGIN_NOT_ALLOWED" };
  }
  return {
    ok: true,
    origin: input.allowedOrigin,
    headers: buildCorsHeaders({
      allowedOrigin: input.allowedOrigin,
      allowMethods: input.allowMethods,
      allowHeaders: input.allowHeaders,
      extra: input.extraHeaders
    })
  };
}
function originNotAllowedBody() {
  return PUBLIC_ORIGIN_NOT_ALLOWED;
}
function originNotAllowedResponse() {
  return new Response(JSON.stringify(originNotAllowedBody()), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
}

// insforge/functions/openpay-create-charge/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : null;
}
function fireTicketEmail(baseUrl, orderId) {
  const bearer = env("TICKET_OPERATOR_BEARER");
  if (!bearer) return;
  fetch(`${baseUrl}/functions/send-ticket-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ order_id: orderId })
  }).catch(() => void 0);
}
async function handler(req) {
  const runtime = openpayRuntime({
    OPENPAY_ENABLED: env("OPENPAY_ENABLED"),
    OPENPAY_SANDBOX: env("OPENPAY_SANDBOX")
  });
  if (!runtime) {
    return json(404, { error: "OPENPAY_DISABLED" });
  }
  const apiBase = runtime.apiBase;
  const msiEnabled = openpayMsiEnabled({ OPENPAY_MSI_ENABLED: env("OPENPAY_MSI_ENABLED") });
  const allowedOrigin = readConfiguredOrigin(env, "CHECKOUT_CORS_ORIGIN");
  const gate = gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: "POST, OPTIONS",
    allowHeaders: "Content-Type, Authorization",
    extraHeaders: { "Content-Type": "application/json" }
  });
  if (!gate.ok) {
    if (gate.kind === "MISSING_CONFIG") return json(503, { error: "CONFIGURATION_ERROR" });
    return originNotAllowedResponse();
  }
  if (req.method === "OPTIONS") {
    const { "Content-Type": _contentType, ...preflight } = gate.headers;
    return new Response(null, { status: 204, headers: preflight });
  }
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, gate.headers);
  const merchantId = env("OPENPAY_MERCHANT_ID");
  const privateKey = env("OPENPAY_PRIVATE_KEY");
  const redirectUrl = env("OPENPAY_REDIRECT_URL");
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!merchantId || !privateKey || !redirectUrl || !baseUrl || !apiKey) {
    return json(500, { error: "CONFIGURATION_ERROR" }, gate.headers);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" }, gate.headers);
  }
  if (browserSuppliedCard(body)) return json(400, { error: "CARD_DATA_REJECTED" }, gate.headers);
  if (browserSuppliedAmount(body)) return json(400, { error: "BROWSER_AMOUNT_REJECTED" }, gate.headers);
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const sourceId = typeof body.source_id === "string" ? body.source_id : "";
  const deviceSessionId = typeof body.device_session_id === "string" ? body.device_session_id : "";
  const preview = body.intent === "preview";
  if (!UUID.test(orderId) || !preview && (!sourceId || !deviceSessionId)) {
    return json(400, { error: "INVALID_REQUEST" }, gate.headers);
  }
  const mode = preview ? { ok: true, mode: "ONE_TIME", installments: 1 } : parsePaymentMode({ mode: body.mode, installments: body.installments });
  if (!mode.ok) return json(400, { error: mode.code }, gate.headers);
  if (mode.mode === "THREE_MSI" && !msiEnabled) {
    return json(400, { error: "MSI_NOT_OFFERED" }, gate.headers);
  }
  const clientIp = trustedClientIp(req.headers);
  if (!clientIp) return json(400, { error: "MISSING_CLIENT_IP" }, gate.headers);
  const admin = createAdminClient({ baseUrl, apiKey });
  const { data: orderData, error: orderError } = await admin.database.from("orders").select("id,state,currency,total_cents,buyer_contact_id").eq("id", orderId).limit(1);
  const order = firstRow(orderData);
  if (orderError || !order) return json(404, { error: "ORDER_NOT_FOUND" }, gate.headers);
  const totalCents = readCents(order.total_cents);
  if (totalCents == null) return json(409, { error: "ORDER_AMOUNT_MISMATCH" }, gate.headers);
  const payable = assessOrder({ state: order.state, currency: order.currency, totalCents });
  if (!payable.ok) return json(409, { error: payable.code }, gate.headers);
  if (preview) {
    const choices = openpayChoicesForAmount(totalCents).filter((count) => count === 1 || msiEnabled);
    return json(200, {
      ok: true,
      preview: true,
      order_id: order.id,
      state: order.state,
      currency: "MXN",
      amount_cents: totalCents,
      modes: choices.map((count) => count === 3 ? "THREE_MSI" : "ONE_TIME"),
      three_msi_eligible: msiEnabled && choices.includes(3)
    }, gate.headers);
  }
  const plan = buildOpenpayCharge({
    attemptId: order.id,
    totalCents,
    installments: mode.installments,
    sourceId,
    deviceSessionId,
    redirectUrl
  });
  if (!plan.ok) return json(400, { error: plan.code }, gate.headers);
  const { data: holdData } = await admin.database.from("capacity_holds").select("state,expires_at").eq("order_id", order.id);
  const holds = Array.isArray(holdData) ? holdData : [];
  const holdCheck = assessHolds(
    holds.map((hold) => ({ state: hold.state, expiresAt: hold.expires_at })),
    (/* @__PURE__ */ new Date()).toISOString()
  );
  if (!holdCheck.ok) return json(409, { error: holdCheck.code }, gate.headers);
  const { data: paymentData } = await admin.database.from("payments").select("provider").eq("order_id", order.id);
  const payments = Array.isArray(paymentData) ? paymentData : [];
  const path = paymentPathAllowed(payments);
  if (!path.ok) return json(409, { error: path.code }, gate.headers);
  if (!order.buyer_contact_id) return json(409, { error: "ORDER_NOT_PAYABLE" }, gate.headers);
  const { data: buyerData } = await admin.database.from("buyer_contacts").select("name,email,phone").eq("id", order.buyer_contact_id).limit(1);
  const buyer = firstRow(buyerData);
  const customerName = buyer?.name?.trim() ?? "";
  const customerEmail = buyer?.email?.trim() ?? "";
  if (!customerName || !customerEmail) return json(409, { error: "ORDER_NOT_PAYABLE" }, gate.headers);
  const customer = {
    name: customerName,
    email: customerEmail,
    ...buyer?.phone?.trim() ? { phone_number: buyer.phone.trim() } : {}
  };
  const { data: attemptData } = await admin.database.from("openpay_payment_attempts").select("id,order_id,openpay_order_ref,openpay_charge_id,mode").eq("order_id", order.id).limit(1);
  let attempt = firstRow(attemptData);
  const action = nextAttemptAction(
    attempt ? { openpayOrderRef: attempt.openpay_order_ref, openpayChargeId: attempt.openpay_charge_id } : null,
    order.id
  );
  if (action.action === "ref_mismatch") return json(409, { error: "ORDER_REF_MISMATCH" }, gate.headers);
  if (action.action === "create_attempt") {
    const { error: insertError } = await admin.database.from("openpay_payment_attempts").insert([{
      order_id: order.id,
      openpay_order_ref: action.openpayOrderRef,
      mode: mode.mode,
      initial_status: null
    }]);
    const { data: reloaded } = await admin.database.from("openpay_payment_attempts").select("id,order_id,openpay_order_ref,openpay_charge_id,mode").eq("order_id", order.id).limit(1);
    attempt = firstRow(reloaded);
    if (insertError && !attempt) return json(409, { error: "ATTEMPT_NOT_CREATED" }, gate.headers);
    if (!attempt) return json(409, { error: "ATTEMPT_NOT_CREATED" }, gate.headers);
    if (attempt.openpay_charge_id) {
      return resumeExistingCharge({
        admin,
        attempt,
        order,
        totalCents,
        merchantId,
        privateKey,
        clientIp,
        baseUrl,
        apiBase,
        headers: gate.headers
      });
    }
  }
  if (!attempt) return json(409, { error: "ATTEMPT_NOT_FOUND" }, gate.headers);
  if (attempt.mode !== mode.mode) return json(409, { error: "MODE_NOT_ALLOWED" }, gate.headers);
  if (attempt.openpay_charge_id) {
    return resumeExistingCharge({
      admin,
      attempt,
      order,
      totalCents,
      merchantId,
      privateKey,
      clientIp,
      baseUrl,
      apiBase,
      headers: gate.headers
    });
  }
  const chargeAttemptId = attemptIdFromOpenpayOrderId(attempt.openpay_order_ref) ?? order.id;
  const charge = buildOpenpayCharge({
    attemptId: chargeAttemptId,
    totalCents,
    installments: mode.installments,
    sourceId,
    deviceSessionId,
    redirectUrl,
    customer
  });
  if (!charge.ok) return json(400, { error: charge.code }, gate.headers);
  let response;
  try {
    response = await fetch(`${apiBase}/v1/${merchantId}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${privateKey}:`)}`,
        "Content-Type": "application/json",
        "X-Forwarded-For": clientIp
      },
      body: JSON.stringify(charge.body)
    });
  } catch {
    return json(504, { error: "PROVIDER_UNKNOWN" }, gate.headers);
  }
  const payload = await response.json().catch(() => ({}));
  const classified = classifyOpenpayCreateBody(response.status, payload);
  if (classified.outcome === "technical") {
    return json(502, { error: "PROVIDER_UNKNOWN" }, gate.headers);
  }
  if (classified.outcome === "business") {
    await admin.database.from("openpay_payment_attempts").update({
      provider_error_code: classified.errorCode,
      provider_error_detail: classified.description,
      last_verified_status: "failed",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", attempt.id);
    return json(402, {
      error: "CHARGE_REJECTED",
      error_code: classified.errorCode,
      description: classified.description
    }, gate.headers);
  }
  if (chargeIsBusinessRejection(classified.status)) {
    const decision2 = chargeIdDecision(attempt.openpay_charge_id, classified.chargeId);
    if (decision2 === "mismatch") return json(409, { error: "CHARGE_ID_MISMATCH" }, gate.headers);
    if (decision2 === "set") {
      await admin.database.from("openpay_payment_attempts").update({
        openpay_charge_id: classified.chargeId,
        provider_error_code: classified.errorCode,
        provider_error_detail: classified.description,
        initial_status: classified.status,
        last_verified_status: classified.status,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", attempt.id).is("openpay_charge_id", null);
      const { data: storedData } = await admin.database.from("openpay_payment_attempts").select("openpay_charge_id").eq("id", attempt.id).limit(1);
      const stored = firstRow(storedData);
      if (chargeIdDecision(stored?.openpay_charge_id ?? null, classified.chargeId) === "mismatch") {
        return json(409, { error: "CHARGE_ID_MISMATCH" }, gate.headers);
      }
    }
    return json(402, {
      error: "CHARGE_REJECTED",
      error_code: classified.errorCode,
      description: classified.description,
      charge_id: classified.chargeId
    }, gate.headers);
  }
  const decision = chargeIdDecision(attempt.openpay_charge_id, classified.chargeId);
  if (decision === "mismatch") return json(409, { error: "CHARGE_ID_MISMATCH" }, gate.headers);
  if (decision === "set") {
    await admin.database.from("openpay_payment_attempts").update({
      openpay_charge_id: classified.chargeId,
      initial_status: safeTechnicalStatus(classified.status),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", attempt.id).is("openpay_charge_id", null);
    const { data: storedData } = await admin.database.from("openpay_payment_attempts").select("openpay_charge_id").eq("id", attempt.id).limit(1);
    const stored = firstRow(storedData);
    if (chargeIdDecision(stored?.openpay_charge_id ?? null, classified.chargeId) === "mismatch") {
      return json(409, { error: "CHARGE_ID_MISMATCH" }, gate.headers);
    }
  }
  return json(200, {
    order_id: order.id,
    openpay_order_ref: attempt.openpay_order_ref,
    charge_id: classified.chargeId,
    status: safeTechnicalStatus(classified.status),
    redirect_url: openpayChargeRedirect(payload.payment_method, apiBase)
  }, gate.headers);
}
async function resumeExistingCharge(input) {
  const chargeId = input.attempt.openpay_charge_id;
  if (!chargeId) return json(409, { error: "ATTEMPT_NOT_FOUND" }, input.headers);
  let response;
  try {
    response = await fetch(`${input.apiBase}/v1/${input.merchantId}/charges/${chargeId}`, {
      headers: {
        Authorization: `Basic ${btoa(`${input.privateKey}:`)}`,
        "X-Forwarded-For": input.clientIp
      }
    });
  } catch {
    return json(504, { error: "PROVIDER_UNKNOWN" }, input.headers);
  }
  if (!response.ok) return json(502, { error: "PROVIDER_LOOKUP_FAILED" }, input.headers);
  const charge = await response.json();
  if (charge.id !== chargeId) return json(409, { error: "CHARGE_ID_MISMATCH" }, input.headers);
  const verified = verifyOpenpayCharge(charge, {
    orderRef: input.attempt.openpay_order_ref,
    totalCents: input.totalCents
  });
  if (!verified.ok) return json(409, { error: verified.code }, input.headers);
  if (failedChargeDisposition(verified.normalized) === "rotate") {
    const nextRef = openpayOrderId(crypto.randomUUID());
    const errorCode = sanitizeErrorCode(charge.error_code);
    const description = sanitizeProviderDetail(charge.error_message);
    await input.admin.database.from("openpay_payment_attempts").update({
      openpay_order_ref: nextRef,
      openpay_charge_id: null,
      rejected_charge_id: chargeId,
      provider_error_code: errorCode,
      provider_error_detail: description,
      last_verified_status: safeTechnicalStatus(charge.status),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", input.attempt.id).eq("openpay_charge_id", chargeId);
    return json(200, {
      order_id: input.order.id,
      error: "CHARGE_REJECTED",
      error_code: errorCode,
      description,
      openpay_order_ref: nextRef,
      charge_id: chargeId,
      status: safeTechnicalStatus(charge.status),
      retryable: true
    }, input.headers);
  }
  if (failedChargeDisposition(verified.normalized) === "stop") {
    return json(409, { error: "CHARGE_CANCELLED" }, input.headers);
  }
  if (!shouldApplyVerified(verified.normalized)) {
    return json(200, {
      order_id: input.order.id,
      openpay_order_ref: input.attempt.openpay_order_ref,
      charge_id: chargeId,
      status: safeTechnicalStatus(charge.status),
      redirect_url: openpayChargeRedirect(charge.payment_method, input.apiBase)
    }, input.headers);
  }
  const { data, error } = await input.admin.database.rpc("openpay_apply_verified_charge", {
    p: verifiedApplyPayload({
      openpayOrderRef: input.attempt.openpay_order_ref,
      chargeId,
      orderId: input.order.id,
      amountCents: input.totalCents,
      externalState: charge.status,
      correlationId: `retry:${chargeId}`.slice(0, 64),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
  if (error) return json(503, { error: "APPLY_UNAVAILABLE" }, input.headers);
  const row = data;
  if (!row?.ok) return json(409, { error: row?.error_code ?? "APPLY_REJECTED" }, input.headers);
  if (shouldSendTicketEmail(row.outcome) && row.order_id) fireTicketEmail(input.baseUrl, row.order_id);
  return json(200, {
    order_id: input.order.id,
    openpay_order_ref: input.attempt.openpay_order_ref,
    charge_id: chargeId,
    status: safeTechnicalStatus(charge.status),
    redirect_url: null,
    outcome: row.outcome ?? null
  }, input.headers);
}
export {
  handler as default
};
