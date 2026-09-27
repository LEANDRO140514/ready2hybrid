// insforge/functions/ops-sales-read/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/sales-read/actors.ts
function actorLabel(user) {
  const profile = user.profile;
  const profileName = profile && typeof profile === "object" && !Array.isArray(profile) ? text(profile.name) : null;
  const name = text(user.name) ?? profileName;
  const email = text(user.email);
  if (name && email) return `${name} \xB7 ${email}`;
  return email ?? name;
}
function usersFromAuthList(body) {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return [];
  for (const key of ["users", "data", "items"]) {
    const value = body[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}
function labelsForActors(users, needed) {
  const labels = [];
  for (const user of users) {
    const id = text(user.id);
    if (!id || !needed.has(id)) continue;
    const label = actorLabel(user);
    if (label) labels.push({ id, label });
  }
  return labels;
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// insforge/functions/_shared/sales-read/adjust.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseFinanceAdjustmentInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  const row = body;
  const orderId = uuid(row.orderId);
  const paymentId = uuid(row.paymentId);
  const providerFeeCents = cents(row.providerFeeCents);
  const providerFeeTaxCents = cents(row.providerFeeTaxCents);
  const otherCostsCents = cents(row.otherCostsCents);
  const notes = notesOf(row.notes);
  if (!orderId || !paymentId || providerFeeCents == null || providerFeeTaxCents == null || otherCostsCents == null || notes === void 0) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  return {
    ok: true,
    input: {
      orderId,
      paymentId,
      providerFeeCents,
      providerFeeTaxCents,
      otherCostsCents,
      notes
    }
  };
}
function uuid(value) {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}
function cents(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}
function notesOf(value) {
  if (value == null) return null;
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (trimmed.length > 2e3) return void 0;
  return trimmed.length === 0 ? null : trimmed;
}
function nextFinanceAdjustment(input) {
  return {
    id: input.existing?.id ?? crypto.randomUUID(),
    orderId: input.payment.orderId,
    paymentId: input.payment.id,
    provider: input.payment.provider,
    providerFeeCents: input.amounts.providerFeeCents,
    providerFeeTaxCents: input.amounts.providerFeeTaxCents,
    otherCostsCents: input.amounts.otherCostsCents,
    notes: input.amounts.notes,
    source: "MANUAL",
    createdBy: input.existing?.createdBy ?? input.userId,
    createdAt: input.existing?.createdAt ?? input.nowIso,
    updatedBy: input.userId,
    updatedAt: input.nowIso
  };
}
async function saveFinanceAdjustment(store, userId, input, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const payment = await store.findPayment(input.paymentId);
  if (!payment || payment.orderId !== input.orderId) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND" };
  }
  const state = await store.findOrderState(input.orderId);
  if (!state) return { ok: false, status: 404, code: "ORDER_NOT_FOUND" };
  if (state !== "PAID") return { ok: false, status: 409, code: "ORDER_NOT_PAID" };
  const existing = await store.findAdjustment(input.orderId);
  const row = nextFinanceAdjustment({
    existing,
    userId,
    nowIso,
    payment,
    amounts: input
  });
  if (existing) {
    const { id, createdBy, createdAt, ...patch } = row;
    void createdBy;
    void createdAt;
    await store.updateAdjustment(id, patch);
  } else {
    await store.insertAdjustment(row);
  }
  return { ok: true };
}
function text2(value) {
  return typeof value === "string" && value.trim() ? value : null;
}
async function firstRow(result) {
  if (result.error) throw new Error("ADJUSTMENT_IO");
  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (!row || typeof row !== "object") return null;
  return row;
}
function adminFinanceStore(admin) {
  return {
    async findPayment(paymentId) {
      const row = await firstRow(
        await admin.database.from("payments").select("id,order_id,provider").eq("id", paymentId).limit(1)
      );
      const id = text2(row?.id);
      const orderId = text2(row?.order_id);
      const provider = text2(row?.provider);
      if (!row || !id || !orderId || !provider) return null;
      return { id, orderId, provider };
    },
    async findOrderState(orderId) {
      const row = await firstRow(
        await admin.database.from("orders").select("state").eq("id", orderId).limit(1)
      );
      return text2(row?.state);
    },
    async findAdjustment(orderId) {
      const row = await firstRow(
        await admin.database.from("payment_finance_adjustments").select("id,created_by,created_at").eq("order_id", orderId).limit(1)
      );
      const id = text2(row?.id);
      const createdBy = text2(row?.created_by);
      const createdAt = text2(row?.created_at);
      if (!id || !createdBy || !createdAt) return null;
      return { id, createdBy, createdAt };
    },
    async insertAdjustment(row) {
      const result = await admin.database.from("payment_finance_adjustments").insert([
        {
          id: row.id,
          order_id: row.orderId,
          payment_id: row.paymentId,
          provider: row.provider,
          provider_fee_cents: row.providerFeeCents,
          provider_fee_tax_cents: row.providerFeeTaxCents,
          other_costs_cents: row.otherCostsCents,
          notes: row.notes,
          source: row.source,
          created_by: row.createdBy,
          created_at: row.createdAt,
          updated_by: row.updatedBy,
          updated_at: row.updatedAt
        }
      ]);
      if (result.error) throw new Error("ADJUSTMENT_IO");
    },
    async updateAdjustment(id, patch) {
      const result = await admin.database.from("payment_finance_adjustments").update({
        order_id: patch.orderId,
        payment_id: patch.paymentId,
        provider: patch.provider,
        provider_fee_cents: patch.providerFeeCents,
        provider_fee_tax_cents: patch.providerFeeTaxCents,
        other_costs_cents: patch.otherCostsCents,
        notes: patch.notes,
        source: patch.source,
        updated_by: patch.updatedBy,
        updated_at: patch.updatedAt
      }).eq("id", id);
      if (result.error) throw new Error("ADJUSTMENT_IO");
    }
  };
}

// insforge/functions/_shared/sales-read/assemble.ts
function text3(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function requiredText(value, fallback = "") {
  return text3(value) ?? fallback;
}
function integer(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
function bool(value) {
  return typeof value === "boolean" ? value : null;
}
function mapAdjustment(row, labels) {
  if (!row) return null;
  const id = text3(row.id);
  const orderId = text3(row.order_id);
  const paymentId = text3(row.payment_id);
  const provider = text3(row.provider);
  const source = text3(row.source);
  const createdBy = text3(row.created_by);
  const createdAt = text3(row.created_at);
  const updatedBy = text3(row.updated_by);
  const updatedAt = text3(row.updated_at);
  const providerFeeCents = integer(row.provider_fee_cents);
  const providerFeeTaxCents = integer(row.provider_fee_tax_cents);
  const otherCostsCents = integer(row.other_costs_cents);
  if (!id || !orderId || !paymentId || !provider || source !== "MANUAL" && source !== "PROVIDER" || !createdBy || !createdAt || !updatedBy || !updatedAt || providerFeeCents == null || providerFeeTaxCents == null || otherCostsCents == null) {
    return null;
  }
  return {
    id,
    orderId,
    paymentId,
    provider,
    providerFeeCents,
    providerFeeTaxCents,
    otherCostsCents,
    notes: text3(row.notes),
    source,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt,
    createdByLabel: labels.get(createdBy) ?? null,
    updatedByLabel: labels.get(updatedBy) ?? null
  };
}
function stageOf(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return text3(snapshot.commercial_stage);
}
function indexBy(rows, key) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}
function assembleSalesSnapshot(bundle, generatedAt) {
  const buyers = new Map(
    bundle.buyers.map((row) => [requiredText(row.id), row])
  );
  const products = new Map(
    bundle.products.map((row) => [requiredText(row.code), row])
  );
  const affiliates = new Map(
    bundle.affiliates.map((row) => [requiredText(row.code), row])
  );
  const participants = new Map(
    bundle.participants.map((row) => [requiredText(row.id), row])
  );
  const itemsByOrder = indexBy(bundle.items, (row) => text3(row.order_id));
  const paymentsByOrder = indexBy(bundle.payments, (row) => text3(row.order_id));
  const regsByOrder = indexBy(bundle.registrations, (row) => text3(row.order_id));
  const ticketsByReg = indexBy(bundle.tickets, (row) => text3(row.registration_id));
  const outboxByTicket = /* @__PURE__ */ new Map();
  for (const row of bundle.outbox) {
    const ref = text3(row.domain_event_ref);
    const match = ref ? /^ticket:(.+)$/.exec(ref) : null;
    if (match?.[1]) outboxByTicket.set(match[1], row);
  }
  const verificationsByOrder = indexBy(bundle.verifications, (row) => text3(row.order_id));
  const membersByTeam = indexBy(bundle.members, (row) => text3(row.team_id));
  const paymentIdToOrder = /* @__PURE__ */ new Map();
  const providerPaymentToOrder = /* @__PURE__ */ new Map();
  for (const row of bundle.payments) {
    const orderId = text3(row.order_id);
    const paymentId = text3(row.id);
    const providerPaymentId = text3(row.provider_payment_id);
    if (orderId && paymentId) paymentIdToOrder.set(paymentId, orderId);
    if (orderId && providerPaymentId) providerPaymentToOrder.set(providerPaymentId, orderId);
  }
  const activityByOrder = indexBy(bundle.activity, (row) => {
    const ref = text3(row.entity_ref);
    if (!ref) return null;
    return paymentIdToOrder.get(ref) ?? providerPaymentToOrder.get(ref) ?? ref;
  });
  const actorLabels = new Map(
    (bundle.actors ?? []).filter((actor) => actor.id && actor.label).map((actor) => [actor.id, actor.label])
  );
  const adjustmentsByOrder = indexBy(bundle.adjustments, (row) => text3(row.order_id));
  const webhooksByOrder = indexBy(bundle.webhooks, (row) => {
    const paymentId = text3(row.payment_id);
    return paymentId ? paymentIdToOrder.get(paymentId) ?? null : null;
  });
  const orders = bundle.orders.map((order) => {
    const id = requiredText(order.id);
    const buyer = buyers.get(requiredText(order.buyer_contact_id));
    const affiliateCode = text3(order.affiliate_code);
    const affiliate = affiliateCode ? affiliates.get(affiliateCode) : void 0;
    const lines = (itemsByOrder.get(id) ?? []).map((item) => {
      const code = requiredText(item.product_code);
      const product = products.get(code);
      return {
        productCode: code,
        productName: requiredText(product?.name, code),
        block: requiredText(product?.block, "\u2014"),
        kind: requiredText(product?.kind, "\u2014"),
        saleState: text3(product?.sale_state),
        teamSize: integer(product?.team_size) ?? 1,
        quantity: integer(item.quantity) ?? 1
      };
    });
    const regs = regsByOrder.get(id) ?? [];
    const tickets = regs.flatMap((reg) => {
      const regId = requiredText(reg.id);
      return (ticketsByReg.get(regId) ?? []).map((ticket) => {
        const ticketId = requiredText(ticket.id);
        const job = outboxByTicket.get(ticketId);
        return {
          id: ticketId,
          state: requiredText(ticket.state, "UNKNOWN"),
          issuedAt: text3(ticket.issued_at),
          folio: text3(ticket.folio),
          emailState: text3(job?.state),
          emailResult: text3(job?.result),
          emailUpdatedAt: text3(job?.updated_at)
        };
      });
    });
    const roster = regs.flatMap((reg) => {
      const teamId = text3(reg.team_id);
      if (teamId) {
        return (membersByTeam.get(teamId) ?? []).slice().sort((a, b) => (integer(a.position) ?? 0) - (integer(b.position) ?? 0)).map((member) => {
          const person2 = participants.get(requiredText(member.participant_id));
          return {
            name: text3(person2?.name),
            role: text3(member.role),
            position: integer(member.position)
          };
        });
      }
      const person = participants.get(requiredText(reg.participant_id));
      if (!person) return [];
      return [{ name: text3(person.name), role: null, position: null }];
    });
    return {
      id,
      trackingRef: requiredText(order.tracking_ref, id),
      state: requiredText(order.state, "UNKNOWN"),
      currency: requiredText(order.currency, "MXN"),
      totalCents: integer(order.total_cents) ?? 0,
      createdAt: requiredText(order.created_at),
      updatedAt: text3(order.updated_at),
      expiresAt: text3(order.expires_at),
      affiliateCode,
      affiliateName: text3(affiliate?.name),
      commercialStage: stageOf(order.commercial_snapshot),
      buyerName: text3(buyer?.name),
      buyerEmail: text3(buyer?.email),
      buyerPhone: text3(buyer?.phone),
      lines,
      payments: (paymentsByOrder.get(id) ?? []).map((payment) => ({
        id: requiredText(payment.id),
        provider: requiredText(payment.provider, "UNKNOWN"),
        providerPaymentId: requiredText(payment.provider_payment_id),
        normalizedState: requiredText(payment.normalized_state, "UNKNOWN"),
        amountCents: integer(payment.amount_cents),
        providerUpdatedAt: text3(payment.provider_updated_at),
        createdAt: text3(payment.created_at)
      })),
      tickets,
      roster,
      activity: (activityByOrder.get(id) ?? []).flatMap((row) => {
        const at = text3(row.created_at);
        const action = text3(row.named_action);
        if (!at || !action) return [];
        const meta = row.sanitized_metadata;
        const paymentRef = meta && typeof meta === "object" && !Array.isArray(meta) ? text3(meta.provider_payment_id) : null;
        return [{ at, action, result: text3(row.result), paymentRef }];
      }),
      webhooks: (webhooksByOrder.get(id) ?? []).map((row) => ({
        receivedAt: text3(row.received_at),
        processedAt: text3(row.processed_at),
        signatureResult: text3(row.signature_result),
        processingState: text3(row.processing_state),
        result: text3(row.result)
      })),
      verifications: (verificationsByOrder.get(id) ?? []).map((row) => ({
        verifiedAt: text3(row.verified_at),
        merchantOk: bool(row.merchant_ownership_ok),
        referenceOk: bool(row.external_reference_ok),
        amountOk: bool(row.amount_ok),
        currencyOk: bool(row.currency_ok),
        normalizedResult: text3(row.normalized_result)
      })),
      adjustment: mapAdjustment((adjustmentsByOrder.get(id) ?? [])[0], actorLabels)
    };
  });
  return { generatedAt, orders };
}

// insforge/functions/_shared/sales-read/gate.ts
function classifySalesReadRequest(view) {
  if (view === "whoami" || view === "snapshot" || view === "upsert-adjustment") {
    return { ok: true, view };
  }
  return { ok: false, status: 403, code: "FORBIDDEN" };
}
function roleMayReadSales(role) {
  return role === "OWNER" || role === "FINANCE";
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

// insforge/functions/ops-sales-read/index.ts
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
function dropId(ids, id) {
  const next = /* @__PURE__ */ new Set();
  for (const value of ids) {
    if (value !== id) next.add(value);
  }
  return next;
}
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
async function loadActorLabels(baseUrl, apiKey, ids) {
  if (ids.size === 0) return [];
  const found = [];
  let pending = new Set(ids);
  let offset = 0;
  const limit = 100;
  try {
    for (let page = 0; page < 5 && pending.size > 0; page += 1) {
      const response = await fetch(
        `${baseUrl}/api/auth/users?offset=${offset}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!response.ok) return found;
      const users = usersFromAuthList(await response.json());
      if (users.length === 0) return found;
      for (const actor of labelsForActors(users, pending)) {
        found.push(actor);
      }
      for (const actor of found) pending = dropId(pending, actor.id);
      if (users.length < limit) return found;
      offset += users.length;
    }
  } catch {
    return found;
  }
  return found;
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
  const view = body && typeof body === "object" && !Array.isArray(body) ? body.view : void 0;
  const classified = classifySalesReadRequest(view);
  if (!classified.ok) {
    return json(classified.status, { ok: false, error: classified.code }, gate.headers);
  }
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) {
    return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, gate.headers);
  }
  try {
    const userId = await resolveUserId(baseUrl, req.headers.get("authorization"));
    if (!userId) {
      return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
    }
    const admin = createAdminClient({ baseUrl, apiKey });
    const { data, error } = await admin.database.from("dashboard_readers").select("role").eq("auth_user_id", userId).limit(1);
    if (error) {
      return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
    }
    const role = Array.isArray(data) ? data[0]?.role : null;
    if (!roleMayReadSales(role)) {
      return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
    }
    if (classified.view === "whoami") {
      return json(200, { ok: true, role, userId }, gate.headers);
    }
    if (classified.view === "upsert-adjustment") {
      const parsed = parseFinanceAdjustmentInput(body);
      if (!parsed.ok) {
        return json(parsed.status, { ok: false, error: parsed.code }, gate.headers);
      }
      const saved = await saveFinanceAdjustment(
        adminFinanceStore(admin),
        userId,
        parsed.input
      );
      if (!saved.ok) {
        return json(saved.status, { ok: false, error: saved.code }, gate.headers);
      }
      return json(200, { ok: true }, gate.headers);
    }
    const [
      orders,
      buyers,
      items,
      products,
      payments,
      registrations,
      tickets,
      outbox,
      verifications,
      activity,
      webhooks,
      affiliates,
      members,
      participants,
      adjustments
    ] = await Promise.all([
      readAll(() => admin.database.from("orders").select(
        "id,buyer_contact_id,state,currency,total_cents,tracking_ref,created_at,updated_at,expires_at,affiliate_code,commercial_snapshot"
      )),
      readAll(() => admin.database.from("buyer_contacts").select("id,name,email,phone")),
      readAll(() => admin.database.from("order_items").select(
        "order_id,product_code,quantity"
      )),
      readAll(() => admin.database.from("products").select(
        "code,name,block,kind,team_size,sale_state"
      )),
      readAll(() => admin.database.from("payments").select(
        "id,order_id,provider,provider_payment_id,normalized_state,amount_cents,provider_updated_at,created_at"
      )),
      readAll(() => admin.database.from("registrations").select(
        "id,order_id,team_id,participant_id"
      )),
      readAll(() => admin.database.from("tickets").select(
        "id,registration_id,state,issued_at,folio"
      )),
      readAll(() => admin.database.from("outbox_delivery_jobs").select(
        "domain_event_ref,state,result,updated_at,communication_type"
      ).eq("communication_type", "TICKET_READY")),
      readAll(() => admin.database.from("payment_verification_records").select(
        "order_id,verified_at,merchant_ownership_ok,external_reference_ok,amount_ok,currency_ok,normalized_result"
      )),
      readAll(() => admin.database.from("activity_log").select(
        "created_at,named_action,result,entity_ref,sanitized_metadata"
      ).in("named_action", [
        "CHECKOUT_PREFERENCE_ATTACHED",
        "WEBHOOK_PAYMENT_APPLIED",
        "WEBHOOK_VERIFICATION_REJECTED",
        "TICKET_REVOKED"
      ])),
      readAll(() => admin.database.from("webhook_events").select(
        "payment_id,received_at,processed_at,signature_result,processing_state,result"
      )),
      readAll(() => admin.database.from("affiliates").select("code,name")),
      readAll(() => admin.database.from("team_members").select(
        "team_id,participant_id,role,position"
      )),
      readAll(() => admin.database.from("participants").select("id,name")),
      readAll(() => admin.database.from("payment_finance_adjustments").select(
        "id,order_id,payment_id,provider,provider_fee_cents,provider_fee_tax_cents,other_costs_cents,notes,source,created_by,created_at,updated_by,updated_at"
      ))
    ]);
    const actorIds = /* @__PURE__ */ new Set();
    for (const row of adjustments) {
      if (typeof row.created_by === "string") actorIds.add(row.created_by);
      if (typeof row.updated_by === "string") actorIds.add(row.updated_by);
    }
    const actors = await loadActorLabels(baseUrl, apiKey, actorIds);
    const snapshot = assembleSalesSnapshot(
      {
        orders,
        buyers,
        items,
        products,
        payments,
        registrations,
        tickets,
        outbox,
        verifications,
        activity,
        webhooks,
        affiliates,
        members,
        participants,
        adjustments,
        actors
      },
      (/* @__PURE__ */ new Date()).toISOString()
    );
    return json(200, snapshot, gate.headers);
  } catch {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
}
export {
  handler as default
};
