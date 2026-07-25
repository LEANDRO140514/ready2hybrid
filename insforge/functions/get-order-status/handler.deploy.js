// insforge/functions/get-order-status/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/public-status/errors.ts
var MESSAGES = {
  METHOD_NOT_ALLOWED: { message: "Method not allowed.", retry: "NO", status: 405 },
  INVALID_REFERENCE: { message: "Order reference is invalid.", retry: "NO", status: 400 },
  ORDER_NOT_FOUND: { message: "Order was not found.", retry: "OPTIONAL", status: 404 },
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

// insforge/functions/get-order-status/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function baseHeaders() {
  const config = loadOrderStatusRuntimeConfig(env);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (config.corsOrigin) {
    headers["Access-Control-Allow-Origin"] = config.corsOrigin;
    headers["Vary"] = "Origin";
  }
  return headers;
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders() });
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
    return new Response(null, { status: 204, headers: baseHeaders() });
  }
  try {
    const result = await orchestrateOrderStatus(req, {
      env,
      repo: createLazyRepo()
    });
    return jsonResponse(result.status, result.body);
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody());
    }
    return jsonResponse(500, new OrderStatusError("INTERNAL_ERROR").toPublicBody());
  }
}
export {
  handler as default
};
