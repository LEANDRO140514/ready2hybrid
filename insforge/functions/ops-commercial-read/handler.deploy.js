// insforge/functions/ops-commercial-read/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/commercial/gate.ts
function roleMayReadCommercialAggregates(role) {
  return role === "OWNER" || role === "FINANCE";
}
function roleMayReadCommercialDirectory(role) {
  return role === "OWNER";
}
function classifyCommercialRead(view) {
  if (view === "aggregates" || view === "rows" || view === "directory") {
    return { ok: true, view };
  }
  return { ok: false, status: 403, code: "FORBIDDEN" };
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

// insforge/functions/ops-commercial-read/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "POST, OPTIONS";
var ALLOW_HEADERS = "Content-Type, Authorization";
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
async function handler(req) {
  const allowedOrigin = readConfiguredOrigin(env, "OPS_DASHBOARD_CORS_ORIGIN", "CHECKOUT_CORS_ORIGIN");
  const gate = gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
  if (req.method === "OPTIONS") {
    if (!gate.ok) return gate.kind === "MISSING_CONFIG" ? json(503, { ok: false, error: "CONFIGURATION_ERROR" }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
    const { "Content-Type": _type, "Cache-Control": _cache, ...preflight } = gate.headers;
    return new Response(null, { status: 204, headers: preflight });
  }
  if (!gate.ok) {
    return gate.kind === "MISSING_CONFIG" ? json(503, { ok: false, error: "CONFIGURATION_ERROR" }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, gate.headers);
  let body = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_REQUEST" }, gate.headers);
  }
  const classified = classifyCommercialRead(body.view);
  if (!classified.ok) return json(classified.status, { ok: false, error: classified.code }, gate.headers);
  const eventCode = typeof body.eventCode === "string" && body.eventCode ? body.eventCode : "HEX-2026";
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, gate.headers);
  const header = req.headers.get("authorization");
  const match = /^Bearer\s+(\S+)/i.exec(header ?? "");
  if (!match?.[1]) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
  const session = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` }
  });
  if (!session.ok) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
  const sessionBody = await session.json();
  const userId = sessionBody.user?.id;
  if (typeof userId !== "string" || !userId) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
  const admin = createAdminClient({ baseUrl, apiKey });
  const reader = await admin.database.from("dashboard_readers").select("role").eq("auth_user_id", userId).limit(1);
  if (reader.error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  const role = Array.isArray(reader.data) ? reader.data[0]?.role : null;
  if (!roleMayReadCommercialAggregates(role)) {
    return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  }
  if (classified.view !== "aggregates" && !roleMayReadCommercialDirectory(role)) {
    return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  }
  const legacyColumns = classified.view === "aggregates" ? "id,event_code,original_status,commercial_status,original_created_at,original_updated_at,category_code_raw,category_name_raw,amount_cents,currency" : "id,event_code,original_status,commercial_status,original_created_at,original_updated_at,buyer_contact_id,original_name,original_email,original_phone,category_code_raw,category_name_raw,amount_cents,currency,team_name_raw,participants_raw,notes_raw,original_payment_id";
  const [legacyResult, funnelResult] = await Promise.all([
    admin.database.from("legacy_registrations").select(legacyColumns).eq("event_code", eventCode),
    admin.database.from("marketing_events").select("event_code,visitor_id,event_type,occurred_at").eq("event_code", eventCode)
  ]);
  if (legacyResult.error || funnelResult.error) {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
  const legacy = (Array.isArray(legacyResult.data) ? legacyResult.data : []).map((row) => {
    const record = row;
    return {
      id: record.id,
      eventCode: record.event_code,
      originalStatus: record.original_status,
      commercialStatus: record.commercial_status,
      originalCreatedAt: record.original_created_at,
      originalUpdatedAt: record.original_updated_at,
      buyerContactId: classified.view === "aggregates" ? null : record.buyer_contact_id,
      name: classified.view === "aggregates" ? null : record.original_name,
      email: classified.view === "aggregates" ? null : record.original_email,
      phone: classified.view === "aggregates" ? null : record.original_phone,
      categoryCode: record.category_code_raw,
      categoryName: record.category_name_raw,
      amountCents: record.amount_cents,
      currency: record.currency,
      teamName: classified.view === "aggregates" ? null : record.team_name_raw ?? null,
      participants: classified.view === "aggregates" ? null : record.participants_raw ?? null,
      notes: classified.view === "aggregates" ? null : record.notes_raw ?? null,
      hasPaymentId: classified.view === "aggregates" ? false : typeof record.original_payment_id === "string" && record.original_payment_id.trim() !== ""
    };
  });
  const funnel = (Array.isArray(funnelResult.data) ? funnelResult.data : []).map((row) => {
    const record = row;
    return {
      eventCode: record.event_code,
      visitorId: record.visitor_id,
      eventType: record.event_type,
      occurredAt: record.occurred_at,
      orderId: null
    };
  });
  if (classified.view === "aggregates") {
    return json(200, {
      ok: true,
      eventCode,
      legacyPaid: legacy.filter((row) => row.commercialStatus === "LEGACY_PAID").length,
      legacyPending: legacy.filter((row) => row.commercialStatus === "LEGACY_PENDING").length,
      legacyGrossCents: legacy.reduce((sum, row) => row.commercialStatus === "LEGACY_PAID" && typeof row.amountCents === "number" ? sum + row.amountCents : sum, 0),
      funnelEvents: funnel.length,
      legacy,
      funnel
    }, gate.headers);
  }
  return json(200, { ok: true, eventCode, legacy, funnel }, gate.headers);
}
export {
  handler as default
};
