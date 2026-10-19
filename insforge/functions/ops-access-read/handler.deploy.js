// insforge/functions/ops-access-read/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// src/access/gate.ts
function roleMayReadAccess(role) {
  return role === "OWNER" || role === "OPERATIONS_MANAGER" || role === "CHECKIN_STAFF";
}

// src/access/assemble.ts
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function rows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => Boolean(row) && typeof row === "object");
}
function accessInputsFromTables(tables) {
  const contacts = /* @__PURE__ */ new Map();
  for (const row of rows(tables.contacts)) {
    const id = text(row.id);
    if (id) contacts.set(id, row);
  }
  const participants = /* @__PURE__ */ new Map();
  for (const row of rows(tables.participants)) {
    const id = text(row.id);
    const name = text(row.name);
    if (id && name) participants.set(id, name);
  }
  const products = /* @__PURE__ */ new Map();
  for (const row of rows(tables.products)) {
    const code = text(row.code);
    const name = text(row.name);
    if (code && name) products.set(code, name);
  }
  const teams = /* @__PURE__ */ new Map();
  for (const row of rows(tables.teams)) {
    const id = text(row.id);
    if (id) teams.set(id, row);
  }
  const manuals = new Set(rows(tables.manuals).map((row) => text(row.order_id)).filter((id) => Boolean(id)));
  const paymentsByOrder = /* @__PURE__ */ new Map();
  for (const row of rows(tables.payments)) {
    if (row.normalized_state !== "APPROVED") continue;
    const orderId = text(row.order_id);
    const paymentId = text(row.provider_payment_id);
    if (!orderId || !paymentId) continue;
    const list = paymentsByOrder.get(orderId) ?? [];
    list.push(paymentId);
    paymentsByOrder.set(orderId, list);
  }
  const regsByOrder = /* @__PURE__ */ new Map();
  for (const row of rows(tables.registrations)) {
    const orderId = text(row.order_id);
    if (!orderId) continue;
    const list = regsByOrder.get(orderId) ?? [];
    list.push(row);
    regsByOrder.set(orderId, list);
  }
  const membersByTeam = /* @__PURE__ */ new Map();
  for (const row of rows(tables.members)) {
    if (row.state === "REMOVED" || row.state === "REPLACED") continue;
    const teamId = text(row.team_id);
    const participantId = text(row.participant_id);
    const name = participantId ? participants.get(participantId) : null;
    if (!teamId || !name) continue;
    const list = membersByTeam.get(teamId) ?? [];
    list.push(name);
    membersByTeam.set(teamId, list);
  }
  const ticketsByReg = /* @__PURE__ */ new Map();
  for (const row of rows(tables.tickets)) {
    const registrationId = text(row.registration_id);
    if (!registrationId) continue;
    const list = ticketsByReg.get(registrationId) ?? [];
    list.push(row);
    ticketsByReg.set(registrationId, list);
  }
  const orders = [];
  for (const row of rows(tables.orders)) {
    const id = text(row.id);
    const state = text(row.state);
    if (!id || !state) continue;
    const contact = contacts.get(text(row.buyer_contact_id) ?? "");
    const regs = (regsByOrder.get(id) ?? []).filter(
      (reg) => state === "PAID" ? reg.state !== "CANCELLED" : true
    );
    const groups = regs.length > 0 ? regs : [null];
    for (const reg of groups) {
      const productCode = reg ? text(reg.product_code) : null;
      const teamId = reg ? text(reg.team_id) : null;
      const team = teamId ? teams.get(teamId) : void 0;
      const memberNames = teamId ? membersByTeam.get(teamId) ?? [] : [];
      const soloId = reg ? text(reg.participant_id) : null;
      const solo = soloId ? participants.get(soloId) : null;
      const people = memberNames.length > 0 ? memberNames : solo ? [solo] : [];
      const ticket = reg ? (ticketsByReg.get(text(reg.id) ?? "") ?? []).find(
        (item) => item.state === "ISSUED" || item.state === "REISSUED"
      ) : void 0;
      orders.push({
        id,
        state,
        manual: manuals.has(id),
        productCode,
        productName: productCode ? products.get(productCode) ?? null : null,
        team: text(team?.name),
        buyerName: text(contact?.name),
        buyerEmail: text(contact?.email),
        buyerPhone: text(contact?.phone),
        approvedPaymentIds: paymentsByOrder.get(id) ?? [],
        reference: text(ticket?.folio) ?? text(ticket?.id),
        people
      });
    }
  }
  const legacy = rows(tables.legacy).map((row) => ({
    recordId: text(row.original_record_id) ?? text(row.id) ?? "",
    commercialStatus: text(row.commercial_status),
    courtesy: row.courtesy === true,
    name: text(row.original_name),
    email: text(row.original_email),
    phone: text(row.original_phone),
    categoryCode: text(row.normalized_product_code) ?? text(row.category_code_raw),
    categoryName: text(row.category_name_raw),
    teamName: text(row.team_name_raw),
    participants: text(row.participants_raw),
    paymentId: text(row.original_payment_id)
  })).filter((row) => row.recordId !== "");
  return { orders, legacy };
}

// src/access/list.ts
var SESSION_DATES = [
  { token: "VIE", session: "Viernes", date: "2026-11-13" },
  { token: "SAB", session: "S\xE1bado", date: "2026-11-14" },
  { token: "DOM", session: "Domingo", date: "2026-11-15" }
];
function parseParticipantNames(raw, fallback) {
  const text2 = raw?.trim() ?? "";
  if (text2.startsWith("[")) {
    try {
      const parsed = JSON.parse(text2);
      if (Array.isArray(parsed)) {
        const names = parsed.filter((item) => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
        if (names.length > 0) return names;
      }
    } catch {
    }
  }
  if (text2) {
    const parts = text2.split(",").map((item) => item.trim()).filter(Boolean);
    if (parts.length > 0) return parts;
  }
  const buyer = fallback?.trim();
  return buyer ? [buyer] : [];
}
function sessionFor(categoryCode, categoryName) {
  const code = (categoryCode ?? "").toUpperCase();
  const name = (categoryName ?? "").toUpperCase();
  for (const item of SESSION_DATES) {
    const inCode = code.includes(item.token);
    const inName = name.includes(item.session.toUpperCase()) || name.includes(item.token);
    if (inCode || inName) return { session: item.session, sessionDate: item.date };
  }
  return { session: null, sessionDate: null };
}
function norm(value) {
  return (value ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
}
function lastName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : name;
}
var DAY_SUFFIX = /\s*(?:[·—–-])\s*(?:Viernes|S[aá]bado|Domingo)\b/giu;
function categoryLabel(raw) {
  const text2 = (raw ?? "").replace(DAY_SUFFIX, "").replace(/\s*\((?:open|superseded schedule)\)/giu, "").replace(/\s*[—–]\s*/gu, " \xB7 ").replace(/\s+/gu, " ").trim();
  return text2;
}
function peopleOf(names, email, phone, buyerName) {
  const buyer = norm(buyerName);
  const captain = buyerName?.trim() || null;
  const kind = names.length === 2 ? "Pareja" : "Equipo";
  return names.map((name) => {
    const contact = names.length === 1 || buyer !== "" && norm(name) === buyer;
    const own = contact ? email : null;
    const ownPhone = contact ? phone : null;
    const note = !own && !ownPhone && names.length > 1 && captain && norm(name) !== buyer ? `${kind} de: ${captain}` : null;
    return { name, email: own, phone: ownPhone, contactNote: note };
  });
}
function buildAccessList(orders, legacy) {
  const paidPaymentIds = /* @__PURE__ */ new Set();
  for (const order of orders) {
    if (order.state !== "PAID") continue;
    for (const id of order.approvedPaymentIds) {
      const trimmed = id.trim();
      if (trimmed) paidPaymentIds.add(trimmed);
    }
  }
  const legacyKept = legacy.filter((row) => {
    if (row.commercialStatus !== "LEGACY_PAID") return false;
    const paymentId = row.paymentId?.trim() ?? "";
    return paymentId === "" || !paidPaymentIds.has(paymentId);
  });
  const legacyPaymentIds = new Set(
    legacyKept.map((row) => row.paymentId?.trim() ?? "").filter((id) => id !== "")
  );
  const people = [];
  for (const order of orders) {
    if (order.state === "REFUNDED" || order.state === "CHARGED_BACK") continue;
    const paid = order.state === "PAID";
    const manual = order.manual && !paid;
    if (!paid && !manual) continue;
    if (order.approvedPaymentIds.some((id) => legacyPaymentIds.has(id.trim()))) continue;
    const session = sessionFor(order.productCode, order.productName);
    const names = order.people.length > 0 ? order.people : parseParticipantNames(null, order.buyerName);
    for (const person of peopleOf(names, order.buyerEmail, order.buyerPhone, order.buyerName)) {
      people.push({
        ...person,
        category: categoryLabel(order.productName) || order.productCode || "Sin categor\xEDa",
        categoryCode: order.productCode,
        team: order.team?.trim() || null,
        session: session.session,
        sessionDate: session.sessionDate,
        origin: "Checkout",
        reference: order.reference?.trim() || order.id
      });
    }
  }
  for (const row of legacyKept) {
    const session = sessionFor(row.categoryCode, row.categoryName);
    const names = parseParticipantNames(row.participants, row.name);
    for (const person of peopleOf(names, row.email, row.phone, row.name)) {
      people.push({
        ...person,
        category: categoryLabel(row.categoryName) || row.categoryCode || "Sin categor\xEDa",
        categoryCode: row.categoryCode,
        team: row.teamName?.trim() || null,
        session: session.session,
        sessionDate: session.sessionDate,
        origin: row.courtesy ? "Cortes\xEDa" : "Legacy",
        reference: row.recordId
      });
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const seenPerson = /* @__PURE__ */ new Set();
  const unique = people.filter((person) => {
    const key = `${norm(person.reference)}
${norm(person.name)}`;
    const personKey = `${norm(person.name)}
${norm(person.categoryCode ?? person.category)}`;
    if (seen.has(key) || seenPerson.has(personKey)) return false;
    seen.add(key);
    seenPerson.add(personKey);
    return true;
  });
  return unique.sort((a, b) => {
    const day = (a.sessionDate ?? "9999").localeCompare(b.sessionDate ?? "9999");
    if (day !== 0) return day;
    const category = a.category.localeCompare(b.category, "es");
    if (category !== 0) return category;
    const team = (a.team ?? "").localeCompare(b.team ?? "", "es");
    if (team !== 0) return team;
    return lastName(a.name).localeCompare(lastName(b.name), "es");
  });
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

// insforge/functions/ops-access-read/index.ts
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
  const rows2 = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await start().range(from, from + pageSize - 1);
    if (error) throw new Error("READ_FAILED");
    const batch = Array.isArray(data) ? data : [];
    for (const row of batch) {
      if (row && typeof row === "object") rows2.push(row);
    }
    if (batch.length < pageSize) break;
  }
  return rows2;
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
  if (!roleMayReadAccess(role)) return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  try {
    const [orders, payments, manuals, registrations, participants, members, teams, contacts, tickets, products, legacy] = await Promise.all([
      readAll(() => admin.database.from("orders").select("id,state,buyer_contact_id")),
      readAll(() => admin.database.from("payments").select("order_id,provider_payment_id,normalized_state")),
      readAll(() => admin.database.from("manual_sale_resolutions").select("order_id")),
      readAll(() => admin.database.from("registrations").select("id,order_id,state,product_code,participant_id,team_id")),
      readAll(() => admin.database.from("participants").select("id,name")),
      readAll(() => admin.database.from("team_members").select("team_id,participant_id,state")),
      readAll(() => admin.database.from("teams").select("id,name,product_code")),
      readAll(() => admin.database.from("buyer_contacts").select("id,name,email,phone")),
      readAll(() => admin.database.from("tickets").select("id,registration_id,state,folio")),
      readAll(() => admin.database.from("products").select("code,name")),
      readAll(() => admin.database.from("legacy_registrations").select(
        "id,original_record_id,commercial_status,courtesy,original_name,original_email,original_phone,normalized_product_code,category_code_raw,category_name_raw,team_name_raw,participants_raw,original_payment_id"
      ).eq("event_code", "HEX-2026"))
    ]);
    const input = accessInputsFromTables({
      orders,
      payments,
      manuals,
      registrations,
      participants,
      members,
      teams,
      contacts,
      tickets,
      products,
      legacy
    });
    return json(200, { ok: true, people: buildAccessList(input.orders, input.legacy) }, gate.headers);
  } catch {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
}
export {
  handler as default
};
