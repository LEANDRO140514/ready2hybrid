// insforge/functions/marketing-capture/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// src/marketing/foundation.ts
var ANONYMOUS_FUNNEL_EVENT_TYPES = [
  "LANDING_VIEW",
  "EXPERIENCE_SELECTED",
  "CATEGORY_SELECTED",
  "CHECKOUT_STARTED"
];
var FUNNEL_EVENT_TYPES = [
  ...ANONYMOUS_FUNNEL_EVENT_TYPES,
  "LEAD_IDENTIFIED",
  "PAYMENT_PENDING",
  "PURCHASE"
];
var CAPTURE_LIMITS = {
  maxBodyBytes: 4096,
  maxMetadataBytes: 512,
  maxValueLength: 200
};
var PII_KEYS = /* @__PURE__ */ new Set(["email", "phone", "name", "nombre", "correo", "telefono", "whatsapp"]);
var META_ALLOW = /* @__PURE__ */ new Set(["experience", "cta_location", "quantity", "format"]);
var TOUCH_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "referrer",
  "landing_path",
  "capturedAt"
];
function createOpaqueId() {
  return crypto.randomUUID();
}
function isOpaqueId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) && !value.includes("@");
}
function hasPiiKey(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (PII_KEYS.has(key.toLowerCase())) return true;
    if (hasPiiKey(child)) return true;
  }
  return false;
}
function sanitizeTouch(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return void 0;
  if (hasPiiKey(value)) return void 0;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!TOUCH_KEYS.includes(key)) continue;
    if (typeof raw !== "string") return void 0;
    const trimmed = raw.slice(0, CAPTURE_LIMITS.maxValueLength);
    if (!trimmed) continue;
    out[key] = trimmed;
  }
  return out;
}
function sanitizeMarketingContext(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (hasPiiKey(raw)) return null;
  const body = raw;
  if (!isOpaqueId(String(body.visitor_id ?? ""))) return null;
  if (!isOpaqueId(String(body.session_id ?? ""))) return null;
  const first = sanitizeTouch(body.first_touch);
  const last = sanitizeTouch(body.last_touch);
  if (first === void 0 || last === void 0) return null;
  return {
    visitor_id: String(body.visitor_id),
    session_id: String(body.session_id),
    first_touch: first,
    last_touch: last
  };
}
function createMarketingStore() {
  return {
    visitors: /* @__PURE__ */ new Map(),
    sessions: /* @__PURE__ */ new Map(),
    visitorSession: /* @__PURE__ */ new Map(),
    touches: /* @__PURE__ */ new Map(),
    events: [],
    links: /* @__PURE__ */ new Map(),
    snapshots: /* @__PURE__ */ new Map()
  };
}
function ensureVisitor(store, now, visitorId = createOpaqueId()) {
  const existing = store.visitors.get(visitorId);
  if (existing) {
    existing.lastSeenAt = now;
    return visitorId;
  }
  store.visitors.set(visitorId, { id: visitorId, createdAt: now, lastSeenAt: now });
  store.touches.set(visitorId, { first: null, last: null });
  return visitorId;
}
function startSession(store, visitorId, sessionId = createOpaqueId()) {
  ensureVisitor(store, (/* @__PURE__ */ new Date()).toISOString(), visitorId);
  store.sessions.set(sessionId, { id: sessionId, visitorId });
  store.visitorSession.set(visitorId, sessionId);
  return sessionId;
}
function recordTouch(store, visitorId, touch) {
  const at = touch.capturedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  ensureVisitor(store, at, visitorId);
  const slot = store.touches.get(visitorId) ?? { first: null, last: null };
  if (!slot.first) slot.first = touch;
  slot.last = touch;
  store.touches.set(visitorId, slot);
}
function knownEvent(known, eventId, eventCode) {
  return known.some((row) => row.eventId === eventId && row.eventCode === eventCode);
}
function ingestAnonymousCapture(store, raw, options) {
  if (options.bodyBytes > CAPTURE_LIMITS.maxBodyBytes) return { ok: false, reason: "size" };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "body" };
  if (hasPiiKey(raw)) return { ok: false, reason: "pii" };
  const body = raw;
  const marketingEventId = String(body.marketing_event_id ?? "");
  const eventId = String(body.event_id ?? "");
  const visitorId = String(body.visitor_id ?? "");
  const sessionId = String(body.session_id ?? "");
  if (!isOpaqueId(marketingEventId) || !isOpaqueId(eventId) || !isOpaqueId(visitorId) || !isOpaqueId(sessionId)) {
    return { ok: false, reason: "uuid" };
  }
  const prior = store.events.find((row2) => row2.marketingEventId === marketingEventId);
  if (prior) return { ok: true, duplicate: true, event: prior };
  const eventCode = typeof body.event_code === "string" ? body.event_code : "";
  if (!knownEvent(options.knownEvents, eventId, eventCode)) return { ok: false, reason: "event" };
  const allowed = options.allowedTypes ?? ANONYMOUS_FUNNEL_EVENT_TYPES;
  const eventType = body.event_type;
  if (typeof eventType !== "string" || !allowed.includes(eventType)) {
    return { ok: false, reason: "event_type" };
  }
  const metadata = readMetadata(body.metadata);
  if (metadata === void 0) return { ok: false, reason: "metadata" };
  ensureVisitor(store, (/* @__PURE__ */ new Date()).toISOString(), visitorId);
  startSession(store, visitorId, sessionId);
  const touches = store.touches.get(visitorId) ?? { first: null, last: null };
  const row = {
    marketingEventId,
    eventId,
    eventCode,
    visitorId,
    sessionId,
    eventType,
    occurredAt: typeof body.occurred_at === "string" ? body.occurred_at : (/* @__PURE__ */ new Date()).toISOString(),
    categoryCode: typeof body.category_code === "string" ? body.category_code.slice(0, 64) : null,
    valueCents: typeof body.value_cents === "number" ? body.value_cents : null,
    currency: typeof body.currency === "string" ? body.currency.slice(0, 3) : null,
    firstTouch: touches.first,
    lastTouch: touches.last,
    metadata
  };
  store.events.push(row);
  return { ok: true, duplicate: false, event: row };
}
function readMetadata(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return void 0;
  if (hasPiiKey(value)) return void 0;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!META_ALLOW.has(key)) return void 0;
    if (typeof raw !== "string" && typeof raw !== "number") return void 0;
    if (typeof raw === "string" && raw.length > CAPTURE_LIMITS.maxValueLength) return void 0;
    out[key] = raw;
  }
  if (JSON.stringify(out).length > CAPTURE_LIMITS.maxMetadataBytes) return void 0;
  return out;
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

// insforge/functions/marketing-capture/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "POST, OPTIONS";
var ALLOW_HEADERS = "Content-Type";
var MAX_BODY = 4096;
function gateOrigin(req) {
  const allowedOrigin = readConfiguredOrigin(env, "CHECKOUT_CORS_ORIGIN");
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    const gate2 = gateOrigin(req);
    if (!gate2.ok) return gate2.kind === "MISSING_CONFIG" ? json(503, { ok: false }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
    return new Response(null, { status: 204, headers: gate2.headers });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, reason: "method" }, { "Content-Type": "application/json" });
  }
  const gate = gateOrigin(req);
  if (!gate.ok) {
    return gate.kind === "MISSING_CONFIG" ? json(503, { ok: false }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
  }
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, reason: "size" }, gate.headers);
  let raw;
  try {
    const parsed2 = JSON.parse(text);
    if (!parsed2 || typeof parsed2 !== "object" || Array.isArray(parsed2)) {
      return json(400, { ok: false, reason: "body" }, gate.headers);
    }
    raw = parsed2;
  } catch {
    return json(400, { ok: false, reason: "body" }, gate.headers);
  }
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) return json(503, { ok: false }, gate.headers);
  const admin = createAdminClient({ baseUrl, apiKey });
  const eventCode = typeof raw.event_code === "string" ? raw.event_code : "";
  const { data: events, error: eventError } = await admin.database.from("events").select("id,code").eq("code", eventCode).limit(1);
  const event = events?.[0] ?? null;
  if (eventError || !event?.id || event.code !== eventCode) {
    return json(400, { ok: false, reason: "event" }, gate.headers);
  }
  if (typeof raw.event_id === "string" && raw.event_id !== event.id) {
    return json(400, { ok: false, reason: "event" }, gate.headers);
  }
  raw.event_id = event.id;
  const store = createMarketingStore();
  const context = sanitizeMarketingContext({
    visitor_id: raw.visitor_id,
    session_id: raw.session_id,
    first_touch: raw.first_touch ?? null,
    last_touch: raw.last_touch ?? null
  });
  if (context?.first_touch) recordTouch(store, context.visitor_id, context.first_touch);
  if (context?.last_touch && context.last_touch !== context.first_touch) {
    recordTouch(store, context.visitor_id, context.last_touch);
  }
  const parsed = ingestAnonymousCapture(store, raw, {
    bodyBytes: text.length,
    knownEvents: [{ eventId: event.id, eventCode }]
  });
  if (!parsed.ok) return json(400, { ok: false, reason: parsed.reason }, gate.headers);
  const row = parsed.event;
  const { data: existing } = await admin.database.from("marketing_events").select("marketing_event_id").eq("marketing_event_id", row.marketingEventId).limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return json(200, { ok: true, duplicate: true }, gate.headers);
  }
  await admin.database.from("marketing_visitors").insert([{ id: row.visitorId }]);
  await admin.database.from("marketing_sessions").insert([{ id: row.sessionId, visitor_id: row.visitorId }]);
  const { error } = await admin.database.from("marketing_events").insert([{
    marketing_event_id: row.marketingEventId,
    event_id: row.eventId,
    event_code: row.eventCode,
    visitor_id: row.visitorId,
    session_id: row.sessionId,
    event_type: row.eventType,
    occurred_at: row.occurredAt,
    category_code: row.categoryCode,
    value_cents: row.valueCents,
    currency: row.currency,
    first_touch: row.firstTouch ?? {},
    last_touch: row.lastTouch ?? {},
    metadata: row.metadata
  }]);
  if (error) {
    const message = String(error.message ?? "");
    if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
      return json(200, { ok: true, duplicate: true }, gate.headers);
    }
    console.warn("marketing-capture write skipped");
    return json(200, { ok: true, stored: false }, gate.headers);
  }
  return json(200, { ok: true, duplicate: false }, gate.headers);
}
export {
  handler as default
};
