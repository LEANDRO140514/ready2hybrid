// insforge/functions/ops-legacy-reconcile/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/legacy-reconcile/input.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var LEGACY_PROVIDERS = ["MERCADOPAGO", "CLIP", "OTHER"];
function classifyLegacyReconcileRequest(view) {
  if (view === "list" || view === "upsert") return { ok: true, view };
  return { ok: false, status: 403, code: "FORBIDDEN" };
}
function roleMayReconcileLegacy(role) {
  return role === "OWNER" || role === "FINANCE";
}
function parseLegacyReconcileInput(body) {
  const bad = { ok: false, status: 400, code: "INVALID_REQUEST" };
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad;
  const row = body;
  const id = row.legacyRegistrationId;
  if (typeof id !== "string" || !UUID_RE.test(id)) return bad;
  const provider = LEGACY_PROVIDERS.find((value) => value === row.provider);
  if (!provider) return bad;
  const deposited = row.depositedCents;
  if (typeof deposited !== "number" || !Number.isInteger(deposited) || deposited < 0) return bad;
  const bankReference = optionalText(row.bankReference, 200);
  const notes = optionalText(row.notes, 2e3);
  if (bankReference === void 0 || notes === void 0) return bad;
  return {
    ok: true,
    input: {
      legacyRegistrationId: id,
      provider,
      depositedCents: deposited,
      bankReference,
      notes
    }
  };
}
function optionalText(value, max) {
  if (value == null) return null;
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (trimmed.length > max) return void 0;
  return trimmed.length === 0 ? null : trimmed;
}
var COURTESY_TAG = /(^|[^a-z])(cortes[ií]a|staff)([^a-z]|$)/i;
function hasCourtesyTag(notes) {
  return typeof notes === "string" && COURTESY_TAG.test(notes);
}
function legacyRowReconcilable(row) {
  if (row.commercialStatus !== "LEGACY_PAID") {
    return { ok: false, status: 409, code: "NOT_LEGACY_PAID" };
  }
  if (typeof row.amountCents !== "number" || !Number.isInteger(row.amountCents) || row.amountCents <= 0) {
    return { ok: false, status: 409, code: "NO_BANK_AMOUNT" };
  }
  return { ok: true, grossCents: row.amountCents };
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

// insforge/functions/ops-legacy-reconcile/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "POST, OPTIONS";
var ALLOW_HEADERS = "Content-Type, Authorization";
var ACTIVE_EVENT_CODE = "HEX-2026";
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
function rows(data) {
  return Array.isArray(data) ? data.filter((item) => !!item && typeof item === "object") : [];
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
    if (!gate.ok) {
      return gate.kind === "MISSING_CONFIG" ? json(503, { ok: false, error: "CONFIGURATION_ERROR" }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
    }
    const { "Content-Type": _type, "Cache-Control": _cache, ...preflight } = gate.headers;
    return new Response(null, { status: 204, headers: preflight });
  }
  if (!gate.ok) {
    return gate.kind === "MISSING_CONFIG" ? json(503, { ok: false, error: "CONFIGURATION_ERROR" }, { "Content-Type": "application/json" }) : originNotAllowedResponse();
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, gate.headers);
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_REQUEST" }, gate.headers);
  }
  const view = body && typeof body === "object" && !Array.isArray(body) ? body.view : void 0;
  const classified = classifyLegacyReconcileRequest(view);
  if (!classified.ok) {
    return json(classified.status, { ok: false, error: classified.code }, gate.headers);
  }
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, gate.headers);
  const match = /^Bearer\s+(\S+)/i.exec(req.headers.get("authorization") ?? "");
  if (!match?.[1]) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
  try {
    const session = await fetch(`${baseUrl}/api/auth/sessions/current`, {
      headers: { Authorization: `Bearer ${match[1]}` }
    });
    if (!session.ok) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
    const sessionBody = await session.json();
    const userId = sessionBody.user?.id;
    if (typeof userId !== "string" || !userId) {
      return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
    }
    const admin = createAdminClient({ baseUrl, apiKey });
    const reader = await admin.database.from("dashboard_readers").select("role").eq("auth_user_id", userId).limit(1);
    if (reader.error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    const role = Array.isArray(reader.data) ? reader.data[0]?.role : null;
    if (!roleMayReconcileLegacy(role)) return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
    if (classified.view === "list") {
      const [legacy, done] = await Promise.all([
        admin.database.from("legacy_registrations").select(
          "id,original_record_id,original_payment_id,category_name_raw,original_updated_at,amount_cents,notes_raw"
        ).eq("event_code", ACTIVE_EVENT_CODE).eq("commercial_status", "LEGACY_PAID"),
        admin.database.from("legacy_reconciliations").select(
          "legacy_registration_id,provider,bank_reference,deposited_cents,provider_fee_cents,reconciled_at,updated_at"
        )
      ]);
      if (legacy.error || done.error) {
        return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
      }
      const byRegistration = /* @__PURE__ */ new Map();
      for (const row of rows(done.data)) {
        if (typeof row.legacy_registration_id === "string") {
          byRegistration.set(row.legacy_registration_id, row);
        }
      }
      const out = rows(legacy.data).map((row) => {
        const found = byRegistration.get(String(row.id));
        return {
          id: row.id,
          recordRef: row.original_record_id,
          operationKey: typeof row.original_payment_id === "string" && row.original_payment_id.trim() ? row.original_payment_id.trim() : null,
          categoryName: row.category_name_raw ?? null,
          paidAt: row.original_updated_at ?? null,
          grossCents: typeof row.amount_cents === "number" ? row.amount_cents : null,
          courtesyTag: hasCourtesyTag(row.notes_raw),
          reconciliation: found ? {
            provider: found.provider,
            bankReference: found.bank_reference ?? null,
            depositedCents: found.deposited_cents,
            feeCents: found.provider_fee_cents,
            reconciledAt: found.reconciled_at,
            updatedAt: found.updated_at
          } : null
        };
      });
      return json(200, { ok: true, eventCode: ACTIVE_EVENT_CODE, rows: out }, gate.headers);
    }
    const parsed = parseLegacyReconcileInput(body);
    if (!parsed.ok) return json(parsed.status, { ok: false, error: parsed.code }, gate.headers);
    const input = parsed.input;
    const registration = await admin.database.from("legacy_registrations").select("id,commercial_status,amount_cents").eq("id", input.legacyRegistrationId).limit(1);
    if (registration.error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    const source = rows(registration.data)[0];
    if (!source) return json(404, { ok: false, error: "REGISTRATION_NOT_FOUND" }, gate.headers);
    const reconcilable = legacyRowReconcilable({
      commercialStatus: source.commercial_status,
      amountCents: source.amount_cents
    });
    if (!reconcilable.ok) {
      return json(reconcilable.status, { ok: false, error: reconcilable.code }, gate.headers);
    }
    if (input.depositedCents > reconcilable.grossCents) {
      return json(422, { ok: false, error: "DEPOSIT_EXCEEDS_GROSS" }, gate.headers);
    }
    const existing = await admin.database.from("legacy_reconciliations").select("id").eq("legacy_registration_id", input.legacyRegistrationId).limit(1);
    if (existing.error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    const existingId = rows(existing.data)[0]?.id;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const write = typeof existingId === "string" ? await admin.database.from("legacy_reconciliations").update({
      provider: input.provider,
      bank_reference: input.bankReference,
      deposited_cents: input.depositedCents,
      notes: input.notes,
      updated_by: userId,
      updated_at: nowIso
    }).eq("id", existingId) : await admin.database.from("legacy_reconciliations").insert([{
      legacy_registration_id: input.legacyRegistrationId,
      provider: input.provider,
      bank_reference: input.bankReference,
      gross_cents: reconcilable.grossCents,
      deposited_cents: input.depositedCents,
      notes: input.notes,
      reconciled_by: userId,
      reconciled_at: nowIso,
      updated_by: userId,
      updated_at: nowIso
    }]);
    if (write.error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    return json(200, { ok: true }, gate.headers);
  } catch {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
}
export {
  handler as default
};
