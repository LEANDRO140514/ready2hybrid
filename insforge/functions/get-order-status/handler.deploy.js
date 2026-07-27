// insforge/functions/get-order-status/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/public-status/errors.ts
var MESSAGES = {
  METHOD_NOT_ALLOWED: { message: "Method not allowed.", retry: "NO", status: 405 },
  INVALID_REFERENCE: { message: "Order reference is invalid.", retry: "NO", status: 400 },
  ORDER_NOT_FOUND: { message: "Order was not found.", retry: "OPTIONAL", status: 404 },
  ORIGIN_NOT_ALLOWED: { message: "Request origin is not allowed.", retry: "NO", status: 403 },
  CONFIGURATION_ERROR: { message: "Order status is not configured.", retry: "NO", status: 503 },
  SERVICE_UNAVAILABLE: { message: "Order status temporarily unavailable.", retry: "OPTIONAL", status: 503 },
  INTERNAL_ERROR: { message: "Unexpected order status error.", retry: "OPTIONAL", status: 500 }
};
var OrderStatusError = class extends Error {
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

// insforge/functions/_shared/public-status/config.ts
function loadOrderStatusRuntimeConfig(env2) {
  const raw = env2("ORDER_STATUS_POLL_SECONDS")?.trim();
  let pollSeconds = 3;
  if (raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      throw new OrderStatusError("CONFIGURATION_ERROR");
    }
    pollSeconds = n;
  }
  const corsOrigin = env2("ORDER_STATUS_CORS_ORIGIN")?.trim() || env2("CHECKOUT_CORS_ORIGIN")?.trim() || null;
  return { pollSeconds, corsOrigin };
}

// insforge/functions/_shared/public-status/mapping.ts
var INTERNAL_TO_PUBLIC = {
  CREATED: "CREATING",
  PREFERENCE_PENDING: "AWAITING_PAYMENT",
  PAYMENT_PENDING: "AWAITING_PAYMENT",
  PAID: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  REQUIRES_REVIEW: "REQUIRES_ACTION",
  REFUNDED: "REFUNDED",
  CHARGED_BACK: "CHARGED_BACK"
};
var TERMINAL_PUBLIC = /* @__PURE__ */ new Set([
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "CHARGED_BACK"
]);
function isKnownInternalOrderState(state) {
  return Object.prototype.hasOwnProperty.call(INTERNAL_TO_PUBLIC, state);
}
function projectPublicOrderStatus(internalState, pollSeconds) {
  if (!isKnownInternalOrderState(internalState)) {
    return {
      status: "REQUIRES_ACTION",
      terminal: false,
      next_poll_after_seconds: pollSeconds
    };
  }
  const status = INTERNAL_TO_PUBLIC[internalState];
  const terminal = TERMINAL_PUBLIC.has(status);
  return {
    status,
    terminal,
    next_poll_after_seconds: terminal ? null : pollSeconds
  };
}

// insforge/functions/_shared/public-status/validate.ts
var PUBLIC_ORDER_REFERENCE_PATTERN = /^trk_[0-9a-f]{32}$/;
function parsePublicOrderReference(raw) {
  if (raw === null || raw === void 0 || !String(raw).trim()) {
    throw new OrderStatusError("INVALID_REFERENCE");
  }
  const value = String(raw).trim().toLowerCase();
  if (!PUBLIC_ORDER_REFERENCE_PATTERN.test(value)) {
    throw new OrderStatusError("INVALID_REFERENCE");
  }
  return value;
}

// insforge/functions/_shared/public-status/orchestrate.ts
async function orchestrateOrderStatus(req, deps) {
  if (req.method !== "GET") {
    throw new OrderStatusError("METHOD_NOT_ALLOWED");
  }
  const config = loadOrderStatusRuntimeConfig(deps.env);
  const url = new URL(req.url);
  const reference = parsePublicOrderReference(url.searchParams.get("reference"));
  let internalState;
  try {
    internalState = await deps.repo.getOrderStateByTrackingRef(reference);
  } catch {
    throw new OrderStatusError("SERVICE_UNAVAILABLE");
  }
  if (internalState === null) {
    throw new OrderStatusError("ORDER_NOT_FOUND");
  }
  const projection = projectPublicOrderStatus(internalState, config.pollSeconds);
  return {
    status: 200,
    body: {
      status: projection.status,
      terminal: projection.terminal,
      next_poll_after_seconds: projection.next_poll_after_seconds
    }
  };
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

// insforge/functions/get-order-status/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "GET, OPTIONS";
var ALLOW_HEADERS = "Content-Type, Authorization";
function gateOrigin(req) {
  const allowedOrigin = readConfiguredOrigin(env, "ORDER_STATUS_CORS_ORIGIN", "CHECKOUT_CORS_ORIGIN");
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
function jsonResponse(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}
function createLazyRepo() {
  let client = null;
  function getClient() {
    if (client) return client;
    const baseUrl = env("INSFORGE_BASE_URL");
    const apiKey = env("API_KEY");
    if (!baseUrl || !apiKey) {
      throw new OrderStatusError("CONFIGURATION_ERROR");
    }
    client = createAdminClient({ baseUrl, apiKey });
    return client;
  }
  return {
    async getOrderStateByTrackingRef(trackingRef) {
      const admin = getClient();
      const { data, error } = await admin.database.from("orders").select("state").eq("tracking_ref", trackingRef).limit(1);
      if (error) {
        throw new OrderStatusError("SERVICE_UNAVAILABLE");
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || typeof row.state !== "string") return null;
      return row.state;
    }
  };
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    const gate2 = gateOrigin(req);
    if (!gate2.ok) {
      if (gate2.kind === "MISSING_CONFIG") {
        return new Response(JSON.stringify(new OrderStatusError("CONFIGURATION_ERROR").toPublicBody()), {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        });
      }
      return originNotAllowedResponse();
    }
    const { "Content-Type": _ct, "Cache-Control": _cc, ...preflightHeaders } = gate2.headers;
    return new Response(null, { status: 204, headers: preflightHeaders });
  }
  const gate = gateOrigin(req);
  if (!gate.ok) {
    if (gate.kind === "MISSING_CONFIG") {
      return new Response(JSON.stringify(new OrderStatusError("CONFIGURATION_ERROR").toPublicBody()), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      });
    }
    return originNotAllowedResponse();
  }
  try {
    loadOrderStatusRuntimeConfig(env);
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody(), gate.headers);
    }
    return jsonResponse(500, new OrderStatusError("INTERNAL_ERROR").toPublicBody(), gate.headers);
  }
  try {
    const result = await orchestrateOrderStatus(req, {
      env,
      repo: createLazyRepo()
    });
    return jsonResponse(result.status, result.body, gate.headers);
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody(), gate.headers);
    }
    return jsonResponse(500, new OrderStatusError("INTERNAL_ERROR").toPublicBody(), gate.headers);
  }
}
export {
  handler as default
};
