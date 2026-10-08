// insforge/functions/openpay-webhook/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/openpay/charge.ts
function openpayOrderId(attemptId) {
  return `r2h_${attemptId.replace(/-/g, "")}`;
}

// insforge/functions/_shared/openpay/attempt.ts
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
function shouldApplyVerified(normalized) {
  return normalized === "APPROVED";
}
function shouldSendTicketEmail(outcome) {
  return outcome === "PAID";
}
function correlationId(eventType, transactionId) {
  return `${transactionId}:${eventType}`.slice(0, 64);
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
var OPENPAY_WEBHOOK_EVENTS = [
  "charge.succeeded",
  "charge.failed",
  "charge.cancelled",
  "charge.refunded",
  "charge.rescored.to.decline",
  "chargeback.created",
  "chargeback.rejected",
  "chargeback.accepted"
];
function normalizeOpenpayChargeStatus(status) {
  if (typeof status !== "string") return "UNKNOWN";
  return CHARGE_STATUS[status.trim().toUpperCase()] ?? "UNKNOWN";
}
function openpayEventShouldFetch(eventType) {
  return OPENPAY_WEBHOOK_EVENTS.includes(eventType);
}

// insforge/functions/_shared/openpay/provider-error.ts
var PAN = /\d{12,19}/g;
var EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
var SECRET = /\b(?:sk|pk)_[A-Za-z0-9]+\b/g;
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

// insforge/functions/_shared/openpay/webhook-auth.ts
function sameSecret(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function basicAuthMatches(header, user, password) {
  if (!header?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  return sameSecret(decoded.slice(0, split), user) && sameSecret(decoded.slice(split + 1), password);
}

// insforge/functions/openpay-webhook/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : null;
}
async function handler(req) {
  const runtime = openpayRuntime({
    OPENPAY_ENABLED: env("OPENPAY_ENABLED"),
    OPENPAY_SANDBOX: env("OPENPAY_SANDBOX")
  });
  if (!runtime) {
    return json(404, { error: "OPENPAY_DISABLED" });
  }
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const webhookUser = env("OPENPAY_WEBHOOK_USER");
  const webhookPassword = env("OPENPAY_WEBHOOK_PASSWORD");
  const merchantId = env("OPENPAY_MERCHANT_ID");
  const privateKey = env("OPENPAY_PRIVATE_KEY");
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!webhookUser || !webhookPassword || !merchantId || !privateKey || !baseUrl || !apiKey) {
    return json(500, { error: "CONFIGURATION_ERROR" });
  }
  if (!basicAuthMatches(req.headers.get("authorization"), webhookUser, webhookPassword)) {
    return json(401, { error: "UNAUTHORIZED" });
  }
  let event;
  try {
    event = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  if (!event.type || !openpayEventShouldFetch(event.type)) {
    return json(200, { ok: true, ignored: true });
  }
  const transactionId = event.transaction?.id;
  if (!transactionId || !/^[A-Za-z0-9_-]{1,64}$/.test(transactionId)) {
    return json(400, { error: "MISSING_TRANSACTION" });
  }
  const chargeResponse = await fetch(`${runtime.apiBase}/v1/${merchantId}/charges/${transactionId}`, {
    headers: { Authorization: `Basic ${btoa(`${privateKey}:`)}` }
  });
  if (!chargeResponse.ok) return json(502, { error: "PROVIDER_LOOKUP_FAILED" });
  const charge = await chargeResponse.json();
  if (!charge.order_id || charge.id !== transactionId) return json(409, { error: "REFERENCE_MISMATCH" });
  const admin = createAdminClient({ baseUrl, apiKey });
  const { data: attemptData, error: attemptError } = await admin.database.from("openpay_payment_attempts").select("id,order_id,openpay_order_ref,openpay_charge_id").eq("openpay_order_ref", charge.order_id).limit(1);
  const attempt = firstRow(attemptData);
  if (attemptError || !attempt) return json(409, { error: "ATTEMPT_NOT_FOUND" });
  if (attempt.openpay_charge_id && attempt.openpay_charge_id !== charge.id) {
    return json(409, { error: "CHARGE_ID_MISMATCH" });
  }
  const { data: orderData, error: orderError } = await admin.database.from("orders").select("id,total_cents,currency").eq("id", attempt.order_id).limit(1);
  const order = firstRow(orderData);
  if (orderError || !order || order.currency !== "MXN") return json(409, { error: "ORDER_NOT_FOUND" });
  const totalCents = typeof order.total_cents === "string" ? Number(order.total_cents) : order.total_cents;
  if (!Number.isSafeInteger(totalCents)) return json(409, { error: "ORDER_AMOUNT_MISMATCH" });
  const verified = verifyOpenpayCharge(charge, {
    orderRef: attempt.openpay_order_ref,
    totalCents
  });
  if (!verified.ok) return json(409, { error: verified.code });
  const chargeDecision = chargeIdDecision(attempt.openpay_charge_id, charge.id);
  if (chargeDecision === "mismatch") return json(409, { error: "CHARGE_ID_MISMATCH" });
  if (chargeDecision === "set") {
    await admin.database.from("openpay_payment_attempts").update({
      openpay_charge_id: charge.id,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", attempt.id).is("openpay_charge_id", null);
    const { data: storedData } = await admin.database.from("openpay_payment_attempts").select("openpay_charge_id").eq("id", attempt.id).limit(1);
    const stored = firstRow(storedData);
    if (chargeIdDecision(stored?.openpay_charge_id ?? null, charge.id) === "mismatch") {
      return json(409, { error: "CHARGE_ID_MISMATCH" });
    }
  }
  if (!shouldApplyVerified(verified.normalized)) {
    await admin.database.from("openpay_payment_attempts").update({
      last_verified_status: safeTechnicalStatus(charge.status),
      provider_error_code: sanitizeErrorCode(charge.error_code),
      provider_error_detail: sanitizeProviderDetail(charge.error_message),
      verified_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", attempt.id).eq("openpay_charge_id", charge.id);
    return json(200, { ok: true, applied: false, status: verified.normalized });
  }
  const { data, error } = await admin.database.rpc("openpay_apply_verified_charge", {
    p: verifiedApplyPayload({
      openpayOrderRef: attempt.openpay_order_ref,
      chargeId: charge.id,
      orderId: order.id,
      amountCents: totalCents,
      externalState: charge.status,
      correlationId: correlationId(event.type, transactionId),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
  if (error) return json(503, { error: "APPLY_UNAVAILABLE" });
  const row = data;
  if (!row?.ok) return json(409, { error: row?.error_code ?? "APPLY_REJECTED" });
  if (shouldSendTicketEmail(row.outcome)) {
    const bearer = env("TICKET_OPERATOR_BEARER");
    const paidOrderId = row.order_id;
    if (bearer && paidOrderId) {
      fetch(`${baseUrl}/functions/send-ticket-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ order_id: paidOrderId })
      }).catch(() => void 0);
    }
  }
  return json(200, { ok: true, outcome: row.outcome ?? null });
}
export {
  handler as default
};
