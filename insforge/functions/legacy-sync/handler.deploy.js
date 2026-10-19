// insforge/functions/legacy-sync/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// src/legacy-sync/dry-run.ts
var RED_FLAGS = [
  "CONFLICTO_OVERRIDE",
  "CANCELADA_CON_PAGO",
  "CONCILIADA",
  "UNICA",
  "CON_BOLETO_QR",
  "PAGADA_CAMBIA_ESTADO"
];
function maskEmail(email) {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return `${email.slice(0, 2)}***`;
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}
function isActive(status, missing) {
  return !missing && status !== "LEGACY_CANCELLED";
}
function buildDryRunReport(plan, sourceCount, ctx) {
  const beforeById = new Map(ctx.mirror.map((row) => [row.recordId, row]));
  const afterById = /* @__PURE__ */ new Map();
  for (const row of ctx.mirror) {
    afterById.set(row.recordId, {
      status: row.commercialStatus,
      product: row.productCode,
      amountCents: row.amountCents,
      paymentId: row.paymentId,
      email: row.email,
      missing: row.missing
    });
  }
  for (const action of plan.actions) {
    if (action.kind === "insert" || action.kind === "update" || action.kind === "reappear") {
      afterById.set(action.recordId, {
        status: action.row.commercialStatus,
        product: action.row.normalizedProductCode,
        amountCents: action.row.amountCents,
        paymentId: action.row.originalPaymentId,
        email: action.row.originalEmail,
        missing: false
      });
    } else if (action.kind === "disappear") {
      const current = afterById.get(action.recordId);
      if (current) afterById.set(action.recordId, { ...current, missing: true });
    }
  }
  const activeByEmail = /* @__PURE__ */ new Map();
  for (const state of afterById.values()) {
    if (!state.email || !isActive(state.status, state.missing)) continue;
    activeByEmail.set(state.email, (activeByEmail.get(state.email) ?? 0) + 1);
  }
  const counts = { insert: 0, update: 0, reappear: 0, disappear: 0, unchanged: 0, conflict: 0 };
  const transitions = {};
  const flagCounts = {};
  const rows = [];
  let redRowCount = 0;
  for (const action of plan.actions) {
    counts[action.kind] += 1;
    if (action.kind === "unchanged") continue;
    const before = beforeById.get(action.recordId) ?? null;
    const after = action.kind === "conflict" ? null : afterById.get(action.recordId) ?? null;
    const flags = [];
    if (action.kind === "conflict") flags.push("CONFLICTO_OVERRIDE");
    else {
      const beforeActive = before ? isActive(before.commercialStatus, before.missing) : false;
      const removed = after ? !isActive(after.status, after.missing) : false;
      const newlyRemoved = removed && (before ? beforeActive : action.kind === "insert");
      const hadPayment = before?.commercialStatus === "LEGACY_PAID" || Boolean(before?.paymentId) || Boolean(after?.paymentId);
      const email = before?.email ?? after?.email ?? null;
      if (newlyRemoved && hadPayment) flags.push("CANCELADA_CON_PAGO");
      if (before && ctx.reconciledIds.has(before.id) && (newlyRemoved || before.commercialStatus !== after?.status)) flags.push("CONCILIADA");
      if (newlyRemoved && email && (activeByEmail.get(email) ?? 0) === 0 && !ctx.paidOrderEmails.has(email)) flags.push("UNICA");
      if (newlyRemoved && email && ctx.ticketEmails.has(email)) flags.push("CON_BOLETO_QR");
      if (before?.commercialStatus === "LEGACY_PAID" && after && after.status !== "LEGACY_PAID") flags.push("PAGADA_CAMBIA_ESTADO");
      if (before?.commercialStatus === "LEGACY_PAID" && after && after.status === "LEGACY_PAID" && before.amountCents !== after.amountCents) {
        flags.push("MONTO_CAMBIA_PAGADA");
      }
      if (before && after) {
        const key = `${before.commercialStatus ?? "NONE"}${before.missing ? "(missing)" : ""} -> ${after.status ?? "NONE"}${after.missing ? "(missing)" : ""}`;
        transitions[key] = (transitions[key] ?? 0) + 1;
      }
    }
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    const red = flags.some((flag) => RED_FLAGS.includes(flag));
    if (red) redRowCount += 1;
    if (red || flags.length > 0 || action.kind !== "update") {
      rows.push({
        recordId: action.recordId,
        kind: action.kind,
        flags,
        before: before ? { status: before.commercialStatus, product: before.productCode, amountCents: before.amountCents, hasPaymentId: Boolean(before.paymentId) } : null,
        after: after ? { status: after.status, product: after.product, amountCents: after.amountCents, hasPaymentId: Boolean(after.paymentId) } : null,
        email: maskEmail(before?.email ?? after?.email ?? null)
      });
    }
  }
  return { dryRun: true, sourceCount, counts, transitions, flagCounts, redRowCount, rows };
}

// src/legacy-sync/plan.ts
var SOURCE_TABLE = "public.hybrid_registro_inscripciones";
var SOURCE_SELECT = `SELECT id::text AS id, category_code, category_name, category_bloque, team_name, participants, contact_name, contact_email, contact_phone, amount, currency, status, created_at, updated_at, mp_payment_id, notes FROM ${SOURCE_TABLE}`;
var SOURCE_PAGE_SIZE = 200;
function sourceCountQuery() {
  return `SELECT count(*)::int AS total FROM ${SOURCE_TABLE}`;
}
function sourcePageQuery(offset) {
  if (!Number.isInteger(offset) || offset < 0) throw new Error("SOURCE_PAGE_INVALID");
  return `${SOURCE_SELECT} ORDER BY id LIMIT ${SOURCE_PAGE_SIZE} OFFSET ${offset}`;
}
function collectSourcePages(total, pages) {
  if (!Number.isInteger(total) || total < 0) throw new Error("SOURCE_COUNT_INVALID");
  if (total === 0) {
    if (pages.some((page) => page.length > 0)) throw new Error("SOURCE_INCOMPLETE");
    return [];
  }
  const rows = [];
  for (const page of pages) {
    if (page.length === 0) throw new Error("SOURCE_PAGE_EMPTY");
    const remaining = total - rows.length;
    if (page.length > SOURCE_PAGE_SIZE || page.length > remaining) throw new Error("SOURCE_INCOMPLETE");
    if (page.length < SOURCE_PAGE_SIZE && page.length !== remaining) throw new Error("SOURCE_INCOMPLETE");
    rows.push(...page);
  }
  if (rows.length !== total) throw new Error("SOURCE_INCOMPLETE");
  const ids = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const id = row.id?.trim();
    if (!id || ids.has(id)) throw new Error("SOURCE_INCOMPLETE");
    ids.add(id);
  }
  return rows;
}
var CANCELLED = /* @__PURE__ */ new Set(["cancelled", "canceled", "refunded", "rejected", "anulado", "cancelado"]);
function mapSourceStatus(status) {
  const value = status?.trim().toLowerCase() ?? "";
  if (value === "paid") return "LEGACY_PAID";
  if (value === "pending") return "LEGACY_PENDING";
  if (CANCELLED.has(value)) return "LEGACY_CANCELLED";
  return null;
}
function amountToCents(amount) {
  if (amount == null || amount === "") return null;
  const value = typeof amount === "number" ? amount : Number(String(amount).trim());
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
function text(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}
function participantsText(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
function hashRow(row) {
  return JSON.stringify([
    row.originalStatus,
    row.commercialStatus,
    row.originalUpdatedAt,
    row.originalEmail,
    row.categoryCode,
    row.normalizedProductCode,
    row.amountCents,
    row.originalPaymentId,
    row.notes,
    row.originalName,
    row.originalPhone,
    row.teamName,
    row.participants
  ]);
}
function planSourceRow(source, catalogCodes) {
  const recordId = text(source.id);
  if (!recordId) return null;
  const reasons = [];
  const commercialStatus = mapSourceStatus(source.status);
  if (!commercialStatus) reasons.push("UNKNOWN_STATUS");
  const categoryCode = text(source.category_code);
  const mapped = Boolean(categoryCode && catalogCodes.has(categoryCode));
  if (!mapped) reasons.push("UNMAPPED_CATEGORY");
  const amountCents = amountToCents(source.amount);
  if (source.amount != null && source.amount !== "" && amountCents == null) reasons.push("AMOUNT_UNPARSEABLE");
  const row = {
    originalStatus: text(source.status) ?? "",
    commercialStatus,
    importDisposition: reasons.length ? "REVIEW_REQUIRED" : "IMPORTED",
    reviewReason: reasons.length ? reasons.join(",") : null,
    originalCreatedAt: text(source.created_at),
    originalUpdatedAt: text(source.updated_at),
    originalName: text(source.contact_name),
    originalEmail: text(source.contact_email)?.toLowerCase() ?? null,
    originalPhone: text(source.contact_phone),
    categoryCode,
    categoryName: text(source.category_name),
    categoryBlock: text(source.category_bloque),
    teamName: text(source.team_name),
    participants: participantsText(source.participants),
    normalizedProductCode: mapped ? categoryCode : null,
    amountCents,
    currency: text(source.currency),
    originalPaymentId: text(source.mp_payment_id),
    notes: text(source.notes),
    snapshot: source
  };
  return { row, reasons };
}
function sourceValue(row, field) {
  if (field === "amount_cents") return row.amountCents == null ? "" : String(row.amountCents);
  if (field === "commercial_status") return row.commercialStatus ?? "";
  if (field === "normalized_product_code") return row.normalizedProductCode ?? "";
  return row.originalPaymentId ?? "";
}
function planLegacySync(input) {
  const mirrorById = new Map(input.mirror.map((row) => [row.originalRecordId, row]));
  const sourceById = /* @__PURE__ */ new Map();
  for (const source of input.source) {
    const recordId = text(source.id);
    if (recordId) sourceById.set(recordId, source);
  }
  const seen = /* @__PURE__ */ new Set();
  const actions = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let disappeared = 0;
  let reappeared = 0;
  let conflicts = 0;
  for (const source of sourceById.values()) {
    const planned = planSourceRow(source, input.catalogCodes);
    if (!planned) continue;
    const recordId = text(source.id);
    seen.add(recordId);
    const nextHash = hashRow(planned.row);
    const current = mirrorById.get(recordId);
    for (const override of input.overrides) {
      if (override.originalRecordId !== recordId) continue;
      const value = sourceValue(planned.row, override.field);
      if (value !== override.sourceValueAtOverride) {
        actions.push({ kind: "conflict", recordId, field: override.field, sourceValue: value });
        conflicts += 1;
      }
    }
    if (!current) {
      actions.push({ kind: "insert", recordId, row: planned.row, nextHash });
      inserted += 1;
      continue;
    }
    const kind = current.missingSince ? "reappear" : "update";
    if (!current.missingSince && current.sourceHash === nextHash) {
      actions.push({ kind: "unchanged", recordId });
      unchanged += 1;
      continue;
    }
    if (current.reviewReason && planned.row.reviewReason == null && current.reviewReason !== "UNKNOWN_STATUS" && !current.reviewReason.includes("UNKNOWN_STATUS") && !current.reviewReason.includes("UNMAPPED_CATEGORY")) {
      planned.row.importDisposition = current.importDisposition === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : planned.row.importDisposition;
      planned.row.reviewReason = current.reviewReason;
    }
    actions.push({ kind, recordId, row: planned.row, nextHash });
    if (kind === "reappear") reappeared += 1;
    else updated += 1;
  }
  for (const current of input.mirror) {
    if (seen.has(current.originalRecordId) || current.missingSince) continue;
    actions.push({ kind: "disappear", recordId: current.originalRecordId });
    disappeared += 1;
  }
  return { actions, inserted, updated, unchanged, disappeared, reappeared, conflicts };
}

// insforge/functions/legacy-sync/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function secretsEqual(expected, actual) {
  const left = new TextEncoder().encode(expected);
  const right = new TextEncoder().encode(actual);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}
function assertReadQuery(query) {
  if (!query.startsWith("SELECT ") || /\b(insert|update|delete|drop|alter)\b/i.test(query)) {
    throw new Error("SOURCE_QUERY_REJECTED");
  }
}
async function readSql(baseUrl, apiKey, query) {
  assertReadQuery(query);
  const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const body = await response.json();
  const rows = body.rows ?? body.result?.rows;
  if (!Array.isArray(rows)) throw new Error("SOURCE_SHAPE");
  return rows;
}
async function readSource(baseUrl, apiKey) {
  const counted = await readSql(baseUrl, apiKey, sourceCountQuery());
  const rawTotal = counted[0]?.total;
  const total = typeof rawTotal === "number" ? rawTotal : Number(rawTotal);
  if (!Number.isInteger(total) || total < 0) throw new Error("SOURCE_COUNT_INVALID");
  const pages = [];
  let offset = 0;
  while (offset < total) {
    const page = await readSql(baseUrl, apiKey, sourcePageQuery(offset));
    pages.push(page);
    if (page.length === 0) break;
    offset += page.length;
  }
  return collectSourcePages(total, pages);
}
async function dryRunContext(sql) {
  const [mirrorRows, reconciled, tickets, orders] = await Promise.all([
    sql.query(`SELECT id, original_record_id, commercial_status, original_payment_id, amount_cents, normalized_product_code, lower(original_email) AS email, missing_since FROM public.legacy_registrations WHERE source_system = 'LEGACY_HYBRID_REGISTRO'`),
    sql.query(`SELECT legacy_registration_id FROM public.legacy_reconciliations`),
    sql.query(`SELECT DISTINCT lower(bc.email) AS email FROM public.buyer_contacts bc JOIN public.orders o ON o.buyer_contact_id = bc.id JOIN public.registrations r ON r.order_id = o.id JOIN public.tickets t ON t.registration_id = r.id WHERE t.state IN ('ISSUED','REISSUED','USED')`),
    sql.query(`SELECT DISTINCT lower(bc.email) AS email FROM public.buyer_contacts bc JOIN public.orders o ON o.buyer_contact_id = bc.id WHERE o.state = 'PAID'`)
  ]);
  const mirror = mirrorRows.map((row) => ({
    id: String(row.id),
    recordId: String(row.original_record_id),
    commercialStatus: row.commercial_status == null ? null : row.commercial_status,
    paymentId: row.original_payment_id == null || row.original_payment_id === "" ? null : String(row.original_payment_id),
    amountCents: row.amount_cents == null ? null : Number(row.amount_cents),
    productCode: row.normalized_product_code == null ? null : String(row.normalized_product_code),
    email: row.email == null ? null : String(row.email),
    missing: row.missing_since != null
  }));
  return {
    mirror,
    reconciledIds: new Set(reconciled.map((row) => String(row.legacy_registration_id))),
    ticketEmails: new Set(tickets.map((row) => String(row.email))),
    paidOrderEmails: new Set(orders.map((row) => String(row.email)))
  };
}
async function runLegacySync(sql, source, catalogCodes, options = {}) {
  const [mirrorRows, overrideRows] = await Promise.all([
    sql.query(`SELECT original_record_id, source_hash, missing_since, commercial_status, import_disposition, review_reason FROM public.legacy_registrations WHERE source_system = 'LEGACY_HYBRID_REGISTRO'`),
    sql.query(`SELECT registration.original_record_id, override.field_name, override.source_value_at_override FROM public.legacy_field_overrides AS override JOIN public.legacy_registrations AS registration ON registration.id = override.legacy_registration_id`)
  ]);
  const mirror = mirrorRows.map((row) => ({
    originalRecordId: String(row.original_record_id),
    sourceHash: row.source_hash == null ? null : String(row.source_hash),
    missingSince: row.missing_since == null ? null : String(row.missing_since),
    commercialStatus: row.commercial_status == null ? null : row.commercial_status,
    importDisposition: String(row.import_disposition),
    reviewReason: row.review_reason == null ? null : String(row.review_reason)
  }));
  const plan = planLegacySync({
    source,
    mirror,
    overrides: overrideRows.map((row) => ({
      originalRecordId: String(row.original_record_id),
      field: String(row.field_name),
      sourceValueAtOverride: String(row.source_value_at_override)
    })),
    catalogCodes
  });
  if (options.dryRun) return buildDryRunReport(plan, source.length, await dryRunContext(sql));
  const payload = JSON.stringify({ sourceCount: source.length, actions: plan.actions }).replaceAll("'", "''");
  const applied = await sql.query(`SELECT public.legacy_sync_apply('${payload}'::jsonb) AS result`);
  return applied[0]?.result ?? null;
}
async function handler(req) {
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  const secret = env("LEGACY_SYNC_SECRET");
  const enformaUrl = env("ENFORMA_API_BASE_URL");
  const enformaKey = env("ENFORMA_READ_API_KEY");
  const baseUrl = env("INSFORGE_BASE_URL");
  const apiKey = env("API_KEY");
  if (!secret || !enformaUrl || !enformaKey || !baseUrl || !apiKey) {
    return json(503, { ok: false, error: "CONFIGURATION_ERROR" });
  }
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(header);
  if (!match?.[1] || !secretsEqual(secret, match[1])) return json(401, { ok: false, error: "UNAUTHORIZED" });
  const body = await req.json().catch(() => null);
  const dryRun = body?.dryRun === true;
  const admin = createAdminClient({ baseUrl, apiKey });
  const sql = {
    async query(query) {
      const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error("LOCAL_SQL_FAILED");
      const body2 = await response.json();
      return body2.rows ?? body2.result?.rows ?? [];
    }
  };
  try {
    const products = await admin.database.from("products").select("code").eq("event_code", "HEX-2026");
    if (products.error) throw new Error("CATALOG_READ_FAILED");
    const catalogCodes = new Set(
      (Array.isArray(products.data) ? products.data : []).map((row) => row.code).filter((code) => typeof code === "string")
    );
    const source = await readSource(enformaUrl.replace(/\/$/, ""), enformaKey);
    const result = await runLegacySync(sql, source, catalogCodes, { dryRun });
    return json(200, { ok: true, result });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "SYNC_FAILED";
    const safe = message.replaceAll("'", "''").slice(0, 300);
    if (dryRun) return json(503, { ok: false, error: "SYNC_FAILED", dryRun: true, detail: safe });
    await sql.query(`SELECT public.legacy_sync_apply('{"error":"${safe}"}'::jsonb)`).catch(() => void 0);
    return json(503, { ok: false, error: "SYNC_FAILED" });
  }
}
export {
  handler as default,
  runLegacySync
};
