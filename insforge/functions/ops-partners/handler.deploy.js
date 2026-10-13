// src/partners/contract.ts
var PARTNER_CODE_RE = /^[A-Z0-9]{3,12}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[0-9+\-().\s]{8,32}$/;
var PARTNER_LIMITS = {
  studioName: 120,
  contactName: 120,
  phone: 32,
  email: 160
};
function normalizePartnerCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!PARTNER_CODE_RE.test(code)) return null;
  return code;
}
function requiredText(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  return trimmed;
}
function parseProfile(row) {
  const studioName = requiredText(row.studioName, PARTNER_LIMITS.studioName);
  const contactName = requiredText(row.contactName, PARTNER_LIMITS.contactName);
  const phone = requiredText(row.phone, PARTNER_LIMITS.phone);
  const email = requiredText(row.email, PARTNER_LIMITS.email);
  if (!studioName || !contactName || !phone || !email) return null;
  if (!PHONE_RE.test(phone) || !EMAIL_RE.test(email)) return null;
  return { studioName, contactName, phone, email };
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parseCreatePartner(body) {
  if (!isRecord(body)) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  const profile = parseProfile(body);
  const code = normalizePartnerCode(typeof body.code === "string" ? body.code : null);
  if (!profile || !code) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  return { ok: true, profile, code };
}
function parseUpdatePartner(body) {
  if (!isRecord(body)) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  const code = normalizePartnerCode(typeof body.code === "string" ? body.code : null);
  if (!code) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  if ("nextCode" in body || body.newCode != null) {
    return { ok: false, status: 400, code: "CODE_IMMUTABLE" };
  }
  const profile = parseProfile(body);
  if (!profile) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  return { ok: true, code, profile };
}
function parseSetActive(body) {
  if (!isRecord(body)) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  const code = normalizePartnerCode(typeof body.code === "string" ? body.code : null);
  if (!code || typeof body.active !== "boolean") {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  return { ok: true, code, active: body.active };
}

// src/partners/admin.ts
function roleMayAdministerPartners(role) {
  return role === "OWNER";
}
function changedFields(current, next) {
  const fields = [
    "studioName",
    "contactName",
    "phone",
    "email"
  ];
  return fields.filter((field) => current[field] !== next[field]);
}
async function createPartner(store, body, nowIso) {
  const parsed = parseCreatePartner(body);
  if (!parsed.ok) return parsed;
  const existing = await store.find(parsed.code);
  if (existing) return { ok: false, status: 409, code: "CODE_TAKEN" };
  const partner = {
    ...parsed.profile,
    code: parsed.code,
    active: true,
    createdAt: nowIso,
    locksLaunchPrice: true
  };
  try {
    await store.insert(partner);
  } catch (error) {
    if (error instanceof Error && error.message === "CODE_TAKEN") {
      return { ok: false, status: 409, code: "CODE_TAKEN" };
    }
    throw error;
  }
  await store.log({
    action: "PARTNER_CREATED",
    code: partner.code,
    metadata: { active: true, locksLaunchPrice: true }
  });
  return { ok: true, value: partner };
}
async function updatePartner(store, body) {
  const parsed = parseUpdatePartner(body);
  if (!parsed.ok) return parsed;
  const existing = await store.find(parsed.code);
  if (!existing) return { ok: false, status: 404, code: "NOT_FOUND" };
  await store.updateProfile(parsed.code, parsed.profile);
  await store.log({
    action: "PARTNER_UPDATED",
    code: parsed.code,
    metadata: { fields: changedFields(existing, parsed.profile) }
  });
  return {
    ok: true,
    value: {
      ...existing,
      ...parsed.profile
    }
  };
}
async function setPartnerActive(store, body) {
  const parsed = parseSetActive(body);
  if (!parsed.ok) return parsed;
  const existing = await store.find(parsed.code);
  if (!existing) return { ok: false, status: 404, code: "NOT_FOUND" };
  await store.setActive(parsed.code, parsed.active);
  await store.log({
    action: parsed.active ? "PARTNER_ACTIVATED" : "PARTNER_DEACTIVATED",
    code: parsed.code,
    metadata: { active: parsed.active }
  });
  return { ok: true, value: { ...existing, active: parsed.active } };
}

// insforge/functions/ops-partners/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

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

// insforge/functions/ops-partners/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "POST, OPTIONS";
var ALLOW_HEADERS = "Content-Type, Authorization";
function gateOrigin(req) {
  const allowedOrigin = readConfiguredOrigin(
    env,
    "OPS_DASHBOARD_CORS_ORIGIN",
    "CHECKOUT_CORS_ORIGIN"
  );
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
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function fromRow(row) {
  if (!row) return null;
  const code = text(row.code);
  const studioName = text(row.name);
  const createdAt = text(row.created_at);
  if (!code || !studioName || !createdAt) return null;
  return {
    code,
    studioName,
    contactName: text(row.contact_name) ?? "",
    phone: text(row.contact_phone) ?? "",
    email: text(row.contact_email) ?? "",
    active: row.active === true,
    createdAt,
    locksLaunchPrice: row.locks_launch_price !== false
  };
}
function adminStore(admin) {
  const table = () => admin.database.from("affiliates");
  return {
    async find(code) {
      const result = await table().select(
        "code,name,contact_name,contact_email,contact_phone,active,created_at,locks_launch_price"
      ).eq("code", code).limit(1);
      if (result.error) throw new Error("PARTNER_IO");
      const rows = Array.isArray(result.data) ? result.data : [];
      const row = rows[0];
      return fromRow(row && typeof row === "object" ? row : null);
    },
    async list() {
      const result = await table().select(
        "code,name,contact_name,contact_email,contact_phone,active,created_at,locks_launch_price"
      ).order("created_at", { ascending: false });
      if (result.error) throw new Error("PARTNER_IO");
      const rows = Array.isArray(result.data) ? result.data : [];
      const partners = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const partner = fromRow(row);
        if (partner) partners.push(partner);
      }
      return partners;
    },
    async insert(partner) {
      const result = await table().insert([{
        code: partner.code,
        name: partner.studioName,
        contact_name: partner.contactName,
        contact_phone: partner.phone,
        contact_email: partner.email,
        active: true,
        locks_launch_price: true,
        commission_bps: 0,
        created_at: partner.createdAt
      }]);
      if (result.error) {
        const message = result.error.message ?? "";
        if (message.includes("duplicate") || message.includes("23505")) throw new Error("CODE_TAKEN");
        throw new Error("PARTNER_IO");
      }
    },
    async updateProfile(code, profile) {
      const result = await table().update({
        name: profile.studioName,
        contact_name: profile.contactName,
        contact_phone: profile.phone,
        contact_email: profile.email
      }).eq("code", code);
      if (result.error) throw new Error("PARTNER_IO");
    },
    async setActive(code, active) {
      const result = await table().update({ active }).eq("code", code);
      if (result.error) throw new Error("PARTNER_IO");
    },
    async log(entry) {
      const result = await admin.database.from("activity_log").insert([{
        actor_ref: "edge:ops-partners",
        named_action: entry.action,
        entity_type: "affiliate",
        entity_ref: entry.code,
        result: "OK",
        sanitized_metadata: entry.metadata
      }]);
      if (result.error) throw new Error("PARTNER_IO");
    }
  };
}
async function resolveUserId(baseUrl, header) {
  const match = /^Bearer\s+(\S+)/i.exec(header ?? "");
  if (!match?.[1]) return null;
  const response = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` }
  });
  if (!response.ok) return null;
  const body = await response.json();
  return typeof body.user?.id === "string" && body.user.id ? body.user.id : null;
}
function commandPayload(body) {
  const profile = body.profile;
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    return { ...profile, code: body.code };
  }
  return body;
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    const gate2 = gateOrigin(req);
    if (!gate2.ok) {
      if (gate2.kind === "MISSING_CONFIG") {
        return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        });
      }
      return originNotAllowedResponse();
    }
    const { "Content-Type": _type, "Cache-Control": _cache, ...preflight } = gate2.headers;
    return new Response(null, { status: 204, headers: preflight });
  }
  const gate = gateOrigin(req);
  if (!gate.ok) {
    if (gate.kind === "MISSING_CONFIG") {
      return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      });
    }
    return originNotAllowedResponse();
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, gate.headers);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_REQUEST" }, gate.headers);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(400, { ok: false, error: "INVALID_REQUEST" }, gate.headers);
  }
  const record = body;
  const action = record.action;
  if (action !== "list" && action !== "create" && action !== "update" && action !== "set-active") {
    return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  }
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) {
    return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, gate.headers);
  }
  try {
    const userId = await resolveUserId(baseUrl, req.headers.get("authorization"));
    if (!userId) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
    const admin = createAdminClient({ baseUrl, apiKey });
    const { data, error } = await admin.database.from("dashboard_readers").select("role").eq("auth_user_id", userId).limit(1);
    if (error) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    const role = Array.isArray(data) ? data[0]?.role : null;
    if (!roleMayAdministerPartners(role)) {
      return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
    }
    const store = adminStore(admin);
    if (action === "list") {
      const partners = await store.list();
      return json(200, { ok: true, partners }, gate.headers);
    }
    const payload = commandPayload(record);
    if (action === "create") {
      const created = await createPartner(store, payload, (/* @__PURE__ */ new Date()).toISOString());
      if (!created.ok) return json(created.status, { ok: false, error: created.code }, gate.headers);
      return json(200, { ok: true, partner: created.value }, gate.headers);
    }
    if (action === "update") {
      const updated = await updatePartner(store, payload);
      if (!updated.ok) return json(updated.status, { ok: false, error: updated.code }, gate.headers);
      return json(200, { ok: true, partner: updated.value }, gate.headers);
    }
    const toggled = await setPartnerActive(store, record);
    if (!toggled.ok) return json(toggled.status, { ok: false, error: toggled.code }, gate.headers);
    return json(200, { ok: true, partner: toggled.value }, gate.headers);
  } catch {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
}
export {
  handler as default
};
