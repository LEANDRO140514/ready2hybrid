// insforge/functions/ops-treasury/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/treasury/write.ts
var METHODS = /* @__PURE__ */ new Set(["transferencia", "efectivo", "tarjeta", "cheque", "otro"]);
var TYPES = /* @__PURE__ */ new Set(["income", "expense", "transfer"]);
var STATUSES = /* @__PURE__ */ new Set(["scheduled", "posted", "cancelled"]);
function roleMayUseTreasury(role) {
  return role === "OWNER" || role === "FINANCE";
}
function classifyTreasuryIntent(value) {
  if (value === "snapshot" || value === "create-account" || value === "update-account" || value === "create-category" || value === "update-category" || value === "create-movement" || value === "update-movement") {
    return { ok: true, intent: value };
  }
  return { ok: false, status: 403, code: "FORBIDDEN" };
}
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function cents(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}
function date(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function optional(value) {
  if (value == null || value === "") return null;
  return typeof value === "string" ? value.trim() : null;
}
function planTreasuryWrite(books, body, actor) {
  if (!actor.trim()) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  const input = body;
  const classified = classifyTreasuryIntent(input.intent);
  if (!classified.ok || classified.intent === "snapshot") {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  if (classified.intent === "create-account") return planAccount(books, input, actor, null);
  if (classified.intent === "update-account") return planAccount(books, input, actor, text(input.id));
  if (classified.intent === "create-category") return planCategory(input, actor, null);
  if (classified.intent === "update-category") return planCategory(input, actor, text(input.id));
  if (classified.intent === "create-movement") return planMovement(books, input, actor, null);
  return planMovement(books, input, actor, text(input.id));
}
function planAccount(books, input, actor, id) {
  const name = text(input.name);
  const openingDate = date(input.openingDate);
  const openingBalanceCents = cents(input.openingBalanceCents);
  if (!name || name.length > 120 || !openingDate || openingBalanceCents == null) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  if (!id) {
    return {
      ok: true,
      table: "treasury_accounts",
      op: "insert",
      row: {
        name,
        opening_balance_cents: openingBalanceCents,
        opening_date: openingDate,
        active: true,
        created_by: actor,
        updated_by: actor
      }
    };
  }
  const current = books.accounts.find((account) => account.id === id);
  if (!current) return { ok: false, status: 404, code: "NOT_FOUND" };
  const used = books.movements.some(
    (movement) => movement.accountId === id || movement.destinationAccountId === id
  );
  if (used && (openingBalanceCents !== current.openingBalanceCents || openingDate !== current.openingDate)) {
    return { ok: false, status: 409, code: "OPENING_FROZEN" };
  }
  return {
    ok: true,
    table: "treasury_accounts",
    op: "update",
    id,
    row: {
      name,
      active: input.active !== false,
      opening_balance_cents: openingBalanceCents,
      opening_date: openingDate,
      updated_by: actor
    }
  };
}
function planCategory(input, actor, id) {
  const name = text(input.name);
  const kind = input.kind === "income" || input.kind === "expense" ? input.kind : null;
  if (!name || name.length > 120 || !kind) return { ok: false, status: 400, code: "INVALID_REQUEST" };
  if (!id) {
    return {
      ok: true,
      table: "treasury_categories",
      op: "insert",
      row: { name, kind, active: true, created_by: actor, updated_by: actor }
    };
  }
  return {
    ok: true,
    table: "treasury_categories",
    op: "update",
    id,
    row: { name, active: input.active !== false, updated_by: actor }
  };
}
function planMovement(books, input, actor, id) {
  const type = TYPES.has(input.type) ? input.type : null;
  const status = STATUSES.has(input.status) ? input.status : null;
  const amountCents = cents(input.amountCents);
  const occurredOn = date(input.occurredOn);
  const concept = text(input.concept);
  const accountId = text(input.accountId);
  const destinationAccountId = optional(input.destinationAccountId);
  const categoryId = optional(input.categoryId);
  const paymentMethod = optional(input.paymentMethod);
  if (!type || !status || amountCents == null || amountCents <= 0 || !occurredOn || !concept || concept.length > 500 || !accountId) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  if (paymentMethod && !METHODS.has(paymentMethod)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  if (status === "posted" && !paymentMethod) return { ok: false, status: 400, code: "PAYMENT_METHOD_REQUIRED" };
  if (status === "cancelled" && !text(input.cancelReason)) {
    return { ok: false, status: 400, code: "CANCEL_REASON_REQUIRED" };
  }
  if (type === "transfer") {
    if (!destinationAccountId || destinationAccountId === accountId || categoryId) {
      return { ok: false, status: 400, code: "INVALID_REQUEST" };
    }
  } else if (destinationAccountId || !categoryId) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  const category = categoryId ? books.categories.find((row2) => row2.id === categoryId) : null;
  if (type !== "transfer" && (!category || category.kind !== type)) {
    return { ok: false, status: 400, code: "CATEGORY_KIND" };
  }
  const row = {
    type,
    status,
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: categoryId,
    payment_method: paymentMethod,
    amount_cents: amountCents,
    occurred_on: occurredOn,
    concept,
    counterparty: optional(input.counterparty),
    notes: optional(input.notes),
    cancel_reason: status === "cancelled" ? text(input.cancelReason) : null,
    updated_by: actor
  };
  if (!id) {
    row.created_by = actor;
    return { ok: true, table: "treasury_movements", op: "insert", row };
  }
  const current = books.movements.find((movement) => movement.id === id);
  if (!current) return { ok: false, status: 404, code: "NOT_FOUND" };
  const transition = movementTransition(current, row);
  if (!transition.ok) return transition;
  return { ok: true, table: "treasury_movements", op: "update", id, row };
}
function movementTransition(current, row) {
  if (current.status === "cancelled") return { ok: false, status: 409, code: "TERMINAL" };
  if (row.type !== current.type) return { ok: false, status: 409, code: "TYPE_IMMUTABLE" };
  if (current.status === "posted") {
    if (row.status !== "cancelled") return { ok: false, status: 409, code: "POSTED_ONLY_CANCELS" };
    const same = row.account_id === current.accountId && row.destination_account_id === current.destinationAccountId && row.category_id === current.categoryId && row.payment_method === current.paymentMethod && row.amount_cents === current.amountCents && row.occurred_on === current.occurredOn && row.concept === current.concept && row.counterparty === current.counterparty && row.notes === current.notes;
    if (!same) return { ok: false, status: 409, code: "POSTED_NOT_EDITABLE" };
  }
  return { ok: true };
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

// insforge/functions/ops-treasury/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
var ALLOW_METHODS = "POST, OPTIONS";
var ALLOW_HEADERS = "Content-Type, Authorization";
function gateOrigin(req) {
  const allowedOrigin = readConfiguredOrigin(env, "OPS_DASHBOARD_CORS_ORIGIN", "CHECKOUT_CORS_ORIGIN");
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
function text2(value) {
  return typeof value === "string" ? value : "";
}
function integer(value) {
  return typeof value === "number" ? value : Number(value);
}
async function resolveActor(baseUrl, header) {
  const match = /^Bearer\s+(\S+)/i.exec(header ?? "");
  if (!match?.[1]) return null;
  const response = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` }
  });
  if (!response.ok) return null;
  const body = await response.json();
  const id = text2(body.user?.id);
  if (!id) return null;
  const email = text2(body.user?.email).trim();
  return { id, label: email || id };
}
function toBooks(accounts, categories, movements) {
  return {
    accounts: accounts.map((row) => ({
      id: text2(row.id),
      name: text2(row.name),
      active: row.active !== false,
      openingBalanceCents: integer(row.opening_balance_cents),
      openingDate: text2(row.opening_date).slice(0, 10)
    })),
    categories: categories.map((row) => ({
      id: text2(row.id),
      name: text2(row.name),
      kind: row.kind === "income" ? "income" : "expense",
      active: row.active !== false
    })),
    movements: movements.map((row) => ({
      id: text2(row.id),
      type: text2(row.type),
      status: text2(row.status),
      accountId: text2(row.account_id),
      destinationAccountId: text2(row.destination_account_id) || null,
      categoryId: text2(row.category_id) || null,
      paymentMethod: text2(row.payment_method) || null,
      amountCents: integer(row.amount_cents),
      occurredOn: text2(row.occurred_on).slice(0, 10),
      concept: text2(row.concept),
      counterparty: text2(row.counterparty) || null,
      notes: text2(row.notes) || null,
      cancelReason: text2(row.cancel_reason) || null,
      createdBy: text2(row.created_by),
      createdAt: text2(row.created_at),
      updatedBy: text2(row.updated_by),
      updatedAt: text2(row.updated_at)
    }))
  };
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
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, gate.headers);
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_REQUEST" }, gate.headers);
  }
  const intent = body && typeof body === "object" && !Array.isArray(body) ? body.intent : void 0;
  const classified = classifyTreasuryIntent(intent);
  if (!classified.ok) return json(classified.status, { ok: false, error: classified.code }, gate.headers);
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: "CONFIGURATION_ERROR" }, gate.headers);
  const actor = await resolveActor(baseUrl, req.headers.get("authorization"));
  if (!actor) return json(401, { ok: false, error: "UNAUTHORIZED" }, gate.headers);
  const admin = createAdminClient({ baseUrl, apiKey });
  const { data: readers, error: roleError } = await admin.database.from("dashboard_readers").select("role").eq("auth_user_id", actor.id).limit(1);
  if (roleError) return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  const role = Array.isArray(readers) ? readers[0]?.role : null;
  if (!roleMayUseTreasury(role)) return json(403, { ok: false, error: "FORBIDDEN" }, gate.headers);
  const [accountRows, categoryRows, movementRows] = await Promise.all([
    admin.database.from("treasury_accounts").select("*").limit(1e3),
    admin.database.from("treasury_categories").select("*").limit(1e3),
    admin.database.from("treasury_movements").select("*").limit(5e3)
  ]);
  if (accountRows.error || categoryRows.error || movementRows.error) {
    return json(503, { ok: false, error: "SERVICE_UNAVAILABLE" }, gate.headers);
  }
  const books = toBooks(
    accountRows.data ?? [],
    categoryRows.data ?? [],
    movementRows.data ?? []
  );
  if (classified.intent === "snapshot") {
    return json(200, { ok: true, books }, gate.headers);
  }
  const planned = planTreasuryWrite(books, { ...body, intent: classified.intent }, actor.label);
  if (!planned.ok) return json(planned.status, { ok: false, error: planned.code }, gate.headers);
  const query = admin.database.from(planned.table);
  const result = planned.op === "insert" ? await query.insert([planned.row]) : await query.update(planned.row).eq("id", planned.id ?? "");
  if (result.error) return json(409, { ok: false, error: "REJECTED" }, gate.headers);
  return json(200, { ok: true }, gate.headers);
}
export {
  handler as default
};
