// insforge/functions/mp-webhook/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/webhook/errors.ts
var MESSAGES = {
  INVALID_REQUEST: { message: "Invalid webhook request.", retry: "NO", status: 400 },
  METHOD_NOT_ALLOWED: { message: "Method not allowed.", retry: "NO", status: 405 },
  UNAUTHORIZED: { message: "Webhook signature rejected.", retry: "NO", status: 401 },
  WEBHOOK_NOT_CONFIGURED: { message: "Webhook is not configured.", retry: "NO", status: 503 },
  CONFIGURATION_ERROR: { message: "Webhook runtime is misconfigured.", retry: "NO", status: 503 },
  UNSUPPORTED_TOPIC: { message: "Notification topic ignored.", retry: "NO", status: 200 },
  PROVIDER_UNAVAILABLE: { message: "Payment provider temporarily unavailable.", retry: "OPTIONAL", status: 503 },
  PAYMENT_NOT_FOUND: { message: "Provider payment was not found.", retry: "NO", status: 404 },
  INTERNAL_ERROR: { message: "Unexpected webhook error.", retry: "OPTIONAL", status: 500 }
};
var WebhookError = class extends Error {
  code;
  status;
  retry;
  constructor(code, detail) {
    const meta = MESSAGES[code];
    super(detail ?? meta.message);
    this.code = code;
    this.status = meta.status;
    this.retry = meta.retry;
  }
  toPublicBody() {
    return {
      error: {
        code: this.code,
        message: MESSAGES[this.code].message,
        retry: this.retry
      }
    };
  }
};

// insforge/functions/_shared/mercadopago/payments.ts
function amountToCents(amount) {
  return Math.round(amount * 100);
}
function createHttpPaymentClient(fetchImpl = fetch) {
  return {
    async getPayment(paymentId, accessToken) {
      let response;
      try {
        response = await fetchImpl(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        });
      } catch {
        throw new WebhookError("PROVIDER_UNAVAILABLE");
      }
      if (response.status === 404) {
        throw new WebhookError("PAYMENT_NOT_FOUND");
      }
      if (response.status === 401 || response.status === 403) {
        throw new WebhookError("CONFIGURATION_ERROR");
      }
      if (response.status >= 500 || response.status === 429) {
        throw new WebhookError("PROVIDER_UNAVAILABLE");
      }
      if (!response.ok) {
        throw new WebhookError("PROVIDER_UNAVAILABLE");
      }
      const json = await response.json();
      if (json.id === void 0 || json.id === null || !json.status) {
        throw new WebhookError("PROVIDER_UNAVAILABLE");
      }
      return {
        ...json,
        id: String(json.id)
      };
    }
  };
}

// insforge/functions/_shared/mercadopago/signature.ts
function parseXSignature(header) {
  if (!header || !header.trim()) return null;
  const parts = /* @__PURE__ */ Object.create(null);
  for (const segment of header.split(",")) {
    const idx = segment.indexOf("=");
    if (idx <= 0) continue;
    const key = segment.slice(0, idx).trim();
    const value = segment.slice(idx + 1).trim();
    if (!key || !value) continue;
    parts[key] = value;
  }
  if (!parts.ts || !/^\d+$/.test(parts.ts)) return null;
  if (!parts.v1 || !/^[a-fA-F0-9]{64}$/.test(parts.v1)) return null;
  return { ts: parts.ts, v1: parts.v1.toLowerCase() };
}
function normalizeDataId(dataId) {
  return dataId.trim().toLowerCase();
}
function buildManifest(dataIdNormalized, xRequestId, ts) {
  return `id:${dataIdNormalized};request-id:${xRequestId};ts:${ts};`;
}
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function validateMercadoPagoWebhookSignature(input) {
  if (!input.xSignature?.trim()) {
    return { ok: false, reason: "MISSING_SIGNATURE" };
  }
  if (!input.xRequestId?.trim()) {
    return { ok: false, reason: "MISSING_REQUEST_ID" };
  }
  if (!input.dataId?.trim()) {
    return { ok: false, reason: "MISSING_DATA_ID" };
  }
  const parts = parseXSignature(input.xSignature);
  if (!parts) {
    return { ok: false, reason: "MALFORMED_SIGNATURE" };
  }
  const dataIdNormalized = normalizeDataId(input.dataId);
  const manifest = buildManifest(dataIdNormalized, input.xRequestId.trim(), parts.ts);
  const expected = await hmacSha256Hex(input.secret, manifest);
  if (!timingSafeEqualHex(expected, parts.v1)) {
    return { ok: false, reason: "MISMATCH" };
  }
  return { ok: true, parts, manifest, dataIdNormalized };
}

// insforge/functions/_shared/webhook/config.ts
function loadWebhookSecret(env2) {
  const webhookSecret = env2("MERCADOPAGO_WEBHOOK_SECRET")?.trim();
  if (!webhookSecret) {
    throw new WebhookError("WEBHOOK_NOT_CONFIGURED");
  }
  return webhookSecret;
}
function loadPaymentAccessConfig(env2) {
  const accessToken = env2("MERCADOPAGO_ACCESS_TOKEN")?.trim();
  if (!accessToken) {
    throw new WebhookError("CONFIGURATION_ERROR");
  }
  const liveRaw = env2("MERCADOPAGO_LIVE_MODE")?.trim().toLowerCase();
  let expectedLiveMode = null;
  if (liveRaw === "true" || liveRaw === "1") expectedLiveMode = true;
  else if (liveRaw === "false" || liveRaw === "0") expectedLiveMode = false;
  const expectedCollectorId = env2("MERCADOPAGO_COLLECTOR_ID")?.trim() || null;
  return {
    accessToken,
    expectedLiveMode,
    expectedCollectorId
  };
}

// insforge/functions/_shared/webhook/normalize.ts
var MAP = {
  approved: "APPROVED",
  pending: "PENDING",
  in_process: "PENDING",
  in_mediation: "PENDING",
  authorized: "PENDING",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  refunded: "REFUNDED",
  charged_back: "CHARGED_BACK"
};
function normalizeProviderPaymentStatus(status) {
  const key = status.trim().toLowerCase();
  const mapped = MAP[key];
  if (!mapped) return "UNKNOWN";
  return mapped;
}
function extractPaymentTopic(queryType, body) {
  const fromQuery = queryType?.trim().toLowerCase() || null;
  const fromBodyType = typeof body.type === "string" ? body.type.trim().toLowerCase() : null;
  const fromBodyTopic = typeof body.topic === "string" ? body.topic.trim().toLowerCase() : null;
  return fromQuery || fromBodyType || fromBodyTopic;
}
function assertSupportedPaymentTopic(topic) {
  if (!topic || topic !== "payment") {
    throw new WebhookError("UNSUPPORTED_TOPIC");
  }
}
function extractDataId(url, body) {
  const fromQuery = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (fromQuery?.trim()) return fromQuery.trim();
  const data = body.data;
  if (data && typeof data === "object" && data !== null && "id" in data) {
    const id = data.id;
    if (id !== void 0 && id !== null && String(id).trim()) return String(id).trim();
  }
  return null;
}

// insforge/functions/_shared/webhook/orchestrate.ts
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sanitizeHeaders(headers) {
  const out = {};
  for (const key of ["content-type", "user-agent", "x-request-id"]) {
    const value = headers.get(key);
    if (value) out[key] = value.slice(0, 200);
  }
  const sig = headers.get("x-signature");
  if (sig) {
    const tsMatch = /ts=(\d+)/.exec(sig);
    out["x-signature-ts"] = tsMatch?.[1] ?? "present";
    out["x-signature"] = "redacted";
  }
  return out;
}
async function orchestrateWebhook(req, deps) {
  if (req.method !== "POST") {
    throw new WebhookError("METHOD_NOT_ALLOWED");
  }
  const url = new URL(req.url);
  const xSignatureEarly = req.headers.get("x-signature");
  if (!xSignatureEarly?.trim()) {
    throw new WebhookError("UNAUTHORIZED");
  }
  const webhookSecret = loadWebhookSecret(deps.env);
  let body = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const raw = await req.json();
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        body = raw;
      } else {
        throw new WebhookError("INVALID_REQUEST");
      }
    } catch (error) {
      if (error instanceof WebhookError) throw error;
      throw new WebhookError("INVALID_REQUEST");
    }
  } else if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    throw new WebhookError("INVALID_REQUEST");
  }
  const dataId = extractDataId(url, body);
  const xRequestId = req.headers.get("x-request-id");
  const xSignature = xSignatureEarly;
  const signature = await validateMercadoPagoWebhookSignature({
    xSignature,
    xRequestId,
    dataId,
    secret: webhookSecret
  });
  if (!signature.ok) {
    throw new WebhookError("UNAUTHORIZED");
  }
  const topic = extractPaymentTopic(url.searchParams.get("type") || url.searchParams.get("topic"), body);
  try {
    assertSupportedPaymentTopic(topic);
  } catch (error) {
    if (error instanceof WebhookError && error.code === "UNSUPPORTED_TOPIC") {
      return {
        status: 200,
        body: { ok: true, ignored: true, reason: "UNSUPPORTED_TOPIC" }
      };
    }
    throw error;
  }
  const paymentConfig = loadPaymentAccessConfig(deps.env);
  const payment = await deps.payments.getPayment(signature.dataIdNormalized, paymentConfig.accessToken);
  const normalizedState = normalizeProviderPaymentStatus(payment.status);
  const amountCents = typeof payment.transaction_amount === "number" ? amountToCents(payment.transaction_amount) : -1;
  const currency = (payment.currency_id || "").toUpperCase();
  const externalReference = (payment.external_reference || "").trim();
  const liveMode = typeof payment.live_mode === "boolean" ? payment.live_mode : null;
  const collectorId = payment.collector_id === void 0 || payment.collector_id === null ? null : String(payment.collector_id);
  let merchantOwnershipOk = true;
  if (paymentConfig.expectedLiveMode !== null && liveMode !== null && liveMode !== paymentConfig.expectedLiveMode) {
    merchantOwnershipOk = false;
  }
  if (paymentConfig.expectedCollectorId && collectorId && collectorId !== paymentConfig.expectedCollectorId) {
    merchantOwnershipOk = false;
  }
  const currencyOk = currency === "MXN";
  const externalReferenceOk = externalReference.length > 0;
  const amountOk = amountCents > 0;
  const sanitizedHeaders = sanitizeHeaders(req.headers);
  const canonicalInputHash = await sha256Hex(
    JSON.stringify({
      dataId: signature.dataIdNormalized,
      requestId: xRequestId,
      ts: signature.parts.ts,
      topic
    })
  );
  const apply = await deps.repo.applyPaymentTx({
    providerNotificationId: xRequestId.trim(),
    notificationType: topic || "payment",
    canonicalInputHash,
    sanitizedHeaders,
    providerPaymentId: String(payment.id),
    externalState: payment.status,
    normalizedState,
    amountCents,
    currency,
    externalReference,
    liveMode,
    collectorId,
    merchantOwnershipOk,
    externalReferenceOk,
    amountOk,
    currencyOk,
    providerCreatedAt: payment.date_created ?? null,
    providerUpdatedAt: payment.date_last_updated ?? null,
    correlationId: xRequestId
  });
  if (!apply.ok) {
    if (apply.error_code === "INTERNAL_ERROR") {
      throw new WebhookError("INTERNAL_ERROR");
    }
    return {
      status: 200,
      body: {
        ok: true,
        applied: false,
        outcome: apply.outcome || "REJECTED_VERIFICATION"
      }
    };
  }
  const outcome = apply.outcome || "APPLIED";
  const applied = !apply.replay && outcome !== "DUPLICATE" && outcome !== "VERIFICATION_REJECTED" && outcome !== "REJECTED_VERIFICATION";
  return {
    status: 200,
    body: {
      ok: true,
      applied,
      replay: Boolean(apply.replay),
      outcome
    }
  };
}

// insforge/functions/mp-webhook/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function createLazyRepo() {
  let inner = null;
  function getInner() {
    if (inner) return inner;
    const baseUrl = env("INSFORGE_BASE_URL");
    const apiKey = env("API_KEY");
    if (!baseUrl || !apiKey) {
      throw new WebhookError("CONFIGURATION_ERROR");
    }
    const admin = createAdminClient({ baseUrl, apiKey });
    inner = {
      async applyPaymentTx(input) {
        const { data, error } = await admin.database.rpc("webhook_apply_payment_tx", {
          p: {
            provider_notification_id: input.providerNotificationId,
            notification_type: input.notificationType,
            canonical_input_hash: input.canonicalInputHash,
            sanitized_headers: input.sanitizedHeaders,
            provider_payment_id: input.providerPaymentId,
            external_state: input.externalState,
            normalized_state: input.normalizedState,
            amount_cents: input.amountCents,
            currency: input.currency,
            external_reference: input.externalReference,
            merchant_ownership_ok: input.merchantOwnershipOk,
            external_reference_ok: input.externalReferenceOk,
            amount_ok: input.amountOk,
            currency_ok: input.currencyOk,
            provider_created_at: input.providerCreatedAt,
            provider_updated_at: input.providerUpdatedAt,
            correlation_id: input.correlationId,
            live_mode: input.liveMode,
            collector_id: input.collectorId
          }
        });
        if (error) {
          throw new WebhookError("INTERNAL_ERROR");
        }
        const row = data;
        return {
          ok: Boolean(row?.ok),
          replay: Boolean(row?.replay),
          outcome: row?.outcome,
          error_code: row?.error_code
        };
      }
    };
    return inner;
  }
  return {
    applyPaymentTx: (input) => getInner().applyPaymentTx(input)
  };
}
async function handler(req) {
  try {
    const result = await orchestrateWebhook(req, {
      env,
      payments: createHttpPaymentClient(),
      repo: createLazyRepo()
    });
    return jsonResponse(result.status, result.body);
  } catch (error) {
    if (error instanceof WebhookError) {
      if (error.code === "UNSUPPORTED_TOPIC") {
        return jsonResponse(200, { ok: true, ignored: true });
      }
      return jsonResponse(error.status, error.toPublicBody());
    }
    return jsonResponse(500, new WebhookError("INTERNAL_ERROR").toPublicBody());
  }
}
export {
  handler as default
};
