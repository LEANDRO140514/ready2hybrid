// insforge/functions/ops-commercial-read/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/commercial/contacts.ts
var RANK = { PAID: 3, PENDING: 2, LEAD: 1 };
var PENDING_STATES = /* @__PURE__ */ new Set(["PAYMENT_PENDING", "PREFERENCE_PENDING"]);
function paymentAlreadyCounted(value, approved) {
  if (!approved || typeof value !== "string") return false;
  const id = value.trim();
  return id.length > 0 && approved.has(id);
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function normalizeContactEmail(value) {
  const email = text(value)?.toLowerCase() ?? null;
  if (!email || !email.includes("@") || email.startsWith("@")) return null;
  return email;
}
function orderStatus(state) {
  if (state === "PAID") return "PAID";
  if (typeof state === "string" && PENDING_STATES.has(state)) return "PENDING";
  return "LEAD";
}
function legacyStatus(row) {
  if (row.commercial_status === "LEGACY_PAID" || row.original_status === "paid") return "PAID";
  if (row.commercial_status === "LEGACY_PENDING" || row.original_status === "pending") return "PENDING";
  return null;
}
function assembleMarketingContacts(source) {
  const productNames = /* @__PURE__ */ new Map();
  for (const product of source.products) {
    const code = text(product.code);
    if (code) productNames.set(code, text(product.name) ?? code);
  }
  const categoriesByOrder = /* @__PURE__ */ new Map();
  for (const item of source.items) {
    const orderId = text(item.order_id);
    const code = text(item.product_code);
    if (!orderId || !code) continue;
    const list = categoriesByOrder.get(orderId) ?? [];
    list.push(productNames.get(code) ?? code);
    categoriesByOrder.set(orderId, list);
  }
  const buyers = /* @__PURE__ */ new Map();
  for (const buyer of source.buyers) {
    const id = text(buyer.id);
    if (id) buyers.set(id, buyer);
  }
  const atoms = [];
  const ordered = /* @__PURE__ */ new Set();
  for (const order of source.orders) {
    const contactId = text(order.buyer_contact_id);
    const buyer = contactId ? buyers.get(contactId) : void 0;
    if (!buyer) continue;
    ordered.add(contactId);
    const status = orderStatus(order.state);
    const total = typeof order.total_cents === "number" ? order.total_cents : 0;
    atoms.push({
      keyHint: `contact:${contactId}`,
      email: normalizeContactEmail(buyer.email),
      name: text(buyer.name),
      phone: text(buyer.phone),
      status,
      legacy: false,
      category: (categoriesByOrder.get(String(order.id)) ?? []).join(" \xB7 ") || null,
      paidCents: status === "PAID" ? total : 0,
      at: text(order.updated_at) ?? text(order.created_at),
      consent: text(buyer.contact_consent_at) != null
    });
  }
  for (const [id, buyer] of buyers) {
    if (ordered.has(id)) continue;
    atoms.push({
      keyHint: `contact:${id}`,
      email: normalizeContactEmail(buyer.email),
      name: text(buyer.name),
      phone: text(buyer.phone),
      status: "LEAD",
      legacy: false,
      category: null,
      paidCents: 0,
      at: text(buyer.created_at),
      consent: text(buyer.contact_consent_at) != null
    });
  }
  for (const row of source.legacy) {
    const status = legacyStatus(row);
    if (!status) continue;
    const amount = typeof row.amount_cents === "number" ? row.amount_cents : 0;
    const countedOnCurrent = status === "PAID" && paymentAlreadyCounted(row.original_payment_id, source.approvedPaymentIds);
    atoms.push({
      keyHint: `legacy:${String(row.id)}`,
      email: normalizeContactEmail(row.original_email),
      name: text(row.original_name),
      phone: text(row.original_phone),
      status,
      legacy: true,
      category: text(row.category_name_raw) ?? text(row.category_code_raw),
      paidCents: status === "PAID" && !countedOnCurrent ? amount : 0,
      at: text(row.original_updated_at) ?? text(row.original_created_at),
      // The legacy source never stored marketing consent.
      consent: false
    });
  }
  const groups = /* @__PURE__ */ new Map();
  for (const atom of atoms) {
    const key = atom.email ? `email:${atom.email}` : atom.keyHint;
    const list = groups.get(key) ?? [];
    list.push(atom);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, list]) => {
    const status = list.reduce(
      (best, atom) => RANK[atom.status] > RANK[best] ? atom.status : best,
      "LEAD"
    );
    const dated = list.map((atom) => atom.at).filter((value) => value != null).sort((a, b) => Date.parse(a) - Date.parse(b));
    const hasLegacy = list.some((atom) => atom.legacy);
    const hasCurrent = list.some((atom) => !atom.legacy);
    const paid = list.reduce((sum, atom) => sum + atom.paidCents, 0);
    return {
      key,
      name: list.find((atom) => atom.name)?.name ?? null,
      email: list.find((atom) => atom.email)?.email ?? null,
      phone: list.find((atom) => atom.phone)?.phone ?? null,
      status,
      origin: hasLegacy && hasCurrent ? "current+legacy" : hasLegacy ? "legacy" : "current",
      categories: [...new Set(list.map((atom) => atom.category).filter((c) => c != null))],
      paidCents: paid,
      firstAt: dated[0] ?? null,
      lastAt: dated[dated.length - 1] ?? null,
      consent: list.some((atom) => atom.consent) ? "recorded" : "not-recorded"
    };
  });
}

// insforge/functions/_shared/commercial/gate.ts
function roleMayReadCommercialAggregates(role) {
  return role === "OWNER" || role === "FINANCE";
}
function roleMayReadCommercialDirectory(role) {
  return role === "OWNER";
}
function roleMayReadMarketingContacts(role) {
  return role === "OWNER" || role === "MARKETING";
}
function classifyCommercialRead(view) {
  if (view === "aggregates" || view === "rows" || view === "directory" || view === "contacts") {
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
async function readAll(start) {
  const pageSize = 1e3;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await start().range(from, from + pageSize - 1);
    if (error) throw new Error("READ_FAILED");
    const batch = Array.isArray(data) ? data : [];
    for (const row of batch) {
      if (row && typeof row === "object") rows.push(row);
    }
    if (batch.length < pageSize) break;
  }
  return rows;
}
async function marketingContacts(admin, eventCode, headers) {
  try {
    const [buyers, orders, items, products, legacy, payments, funnel] = await Promise.all([
      readAll(() => admin.database.from("buyer_contacts").select(
        "id,name,email,phone,contact_consent_at,created_at"
      )),
      readAll(() => admin.database.from("orders").select(
        "id,buyer_contact_id,state,total_cents,created_at,updated_at"
      )),
      readAll(() => admin.database.from("order_items").select("order_id,product_code")),
      readAll(() => admin.database.from("products").select("code,name")),
      readAll(() => admin.database.from("legacy_registrations").select(
        "id,original_status,commercial_status,original_created_at,original_updated_at,original_name,original_email,original_phone,category_code_raw,category_name_raw,amount_cents,original_payment_id"
      ).eq("event_code", eventCode)),
      readAll(() => admin.database.from("payments").select("provider_payment_id,normalized_state")),
      readAll(() => admin.database.from("marketing_events").select("visitor_id,event_type").eq("event_code", eventCode))
    ]);
    const visitors = /* @__PURE__ */ new Set();
    const identified = /* @__PURE__ */ new Set();
    for (const row of funnel) {
      if (typeof row.visitor_id !== "string") continue;
      visitors.add(row.visitor_id);
      if (row.event_type === "LEAD_IDENTIFIED") identified.add(row.visitor_id);
    }
    const approvedPaymentIds = /* @__PURE__ */ new Set();
    for (const row of payments) {
      if (row.normalized_state !== "APPROVED" || typeof row.provider_payment_id !== "string") continue;
      const id = row.provider_payment_id.trim();
      if (id) approvedPaymentIds.add(id);
    }
    const contacts = assembleMarketingContacts({ buyers, orders, items, products, legacy, approvedPaymentIds });
    return json(200, {
      ok: true,
      eventCode,
      contacts,
      visitors: visitors.size,
      identifiedVisitors: identified.size
    }, headers);
  } catch {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, headers);
  }
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
  if (classified.view === "contacts") {
    if (!roleMayReadMarketingContacts(role)) {
      return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
    }
    return await marketingContacts(admin, eventCode, gate.headers);
  }
  if (!roleMayReadCommercialAggregates(role)) {
    return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  }
  if (classified.view !== "aggregates" && !roleMayReadCommercialDirectory(role)) {
    return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  }
  const legacyColumns = classified.view === "aggregates" ? "id,event_code,original_status,commercial_status,original_created_at,original_updated_at,original_email,category_code_raw,category_name_raw,normalized_product_code,amount_cents,currency,original_payment_id,missing_since" : "id,event_code,original_status,commercial_status,original_created_at,original_updated_at,buyer_contact_id,original_name,original_email,original_phone,category_code_raw,category_name_raw,normalized_product_code,amount_cents,currency,team_name_raw,participants_raw,notes_raw,original_payment_id,missing_since";
  const [legacyResult, funnelResult, syncResult, manualResult, overrideResult] = await Promise.all([
    admin.database.from("legacy_registrations").select(legacyColumns).eq("event_code", eventCode),
    admin.database.from("marketing_events").select("event_code,visitor_id,event_type,occurred_at").eq("event_code", eventCode),
    admin.database.from("legacy_sync_runs").select("finished_at,status,inserted_count,updated_count,disappeared_count,conflict_count,error_message").order("started_at", { ascending: false }).limit(20),
    admin.database.from("manual_sale_resolutions").select("order_id,resolution"),
    admin.database.from("legacy_field_overrides").select("legacy_registration_id,field_name,override_value,conflict")
  ]);
  if (legacyResult.error || funnelResult.error || syncResult.error || manualResult.error || overrideResult.error) {
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
      email: typeof record.original_email === "string" ? record.original_email : null,
      phone: classified.view === "aggregates" ? null : record.original_phone,
      categoryCode: record.normalized_product_code ?? record.category_code_raw,
      categoryName: record.category_name_raw,
      amountCents: record.amount_cents,
      currency: record.currency,
      teamName: classified.view === "aggregates" ? null : record.team_name_raw ?? null,
      participants: classified.view === "aggregates" ? null : record.participants_raw ?? null,
      notes: classified.view === "aggregates" ? null : record.notes_raw ?? null,
      originalPaymentId: typeof record.original_payment_id === "string" ? record.original_payment_id : null,
      missingSince: typeof record.missing_since === "string" ? record.missing_since : null,
      hasPaymentId: typeof record.original_payment_id === "string" && record.original_payment_id.trim() !== ""
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
  const syncRows = Array.isArray(syncResult.data) ? syncResult.data : [];
  const latestSuccess = syncRows.find((row) => row.status === "SUCCESS");
  const latestError = syncRows.find((row) => row.status === "ERROR");
  const sync = {
    lastSuccessAt: typeof latestSuccess?.finished_at === "string" ? latestSuccess.finished_at : null,
    lastErrorAt: typeof latestError?.finished_at === "string" ? latestError.finished_at : null,
    lastError: typeof latestError?.error_message === "string" ? latestError.error_message : null,
    inserted: typeof latestSuccess?.inserted_count === "number" ? latestSuccess.inserted_count : null,
    updated: typeof latestSuccess?.updated_count === "number" ? latestSuccess.updated_count : null,
    disappeared: typeof latestSuccess?.disappeared_count === "number" ? latestSuccess.disappeared_count : null,
    conflicts: typeof latestSuccess?.conflict_count === "number" ? latestSuccess.conflict_count : null
  };
  const manualSaleOrderIds = (Array.isArray(manualResult.data) ? manualResult.data : []).map((row) => row.order_id).filter((id) => typeof id === "string");
  const overrides = (Array.isArray(overrideResult.data) ? overrideResult.data : []).flatMap((row) => {
    const record = row;
    if (typeof record.legacy_registration_id !== "string" || record.field_name !== "amount_cents") return [];
    const valueCents = Number(record.override_value);
    if (!Number.isFinite(valueCents)) return [];
    return [{
      legacyId: record.legacy_registration_id,
      field: "amount_cents",
      valueCents,
      conflict: record.conflict === true
    }];
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
      funnel,
      sync,
      manualSaleOrderIds,
      overrides
    }, gate.headers);
  }
  return json(200, { ok: true, eventCode, legacy, funnel, sync, manualSaleOrderIds, overrides }, gate.headers);
}
export {
  handler as default
};
