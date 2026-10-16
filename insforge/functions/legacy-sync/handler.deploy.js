// insforge/functions/legacy-sync/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// src/legacy-sync/plan.ts
var SOURCE_TABLE = "public.hybrid_registro_inscripciones";
var SOURCE_SELECT = `SELECT id::text AS id, category_code, category_name, category_bloque, team_name, participants, contact_name, contact_email, contact_phone, amount, currency, status, created_at, updated_at, mp_payment_id, notes FROM ${SOURCE_TABLE}`;
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
async function readSource(baseUrl, apiKey) {
  if (!SOURCE_SELECT.startsWith("SELECT ") || /\b(insert|update|delete|drop|alter)\b/i.test(SOURCE_SELECT)) {
    throw new Error("SOURCE_QUERY_REJECTED");
  }
  const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SOURCE_SELECT })
  });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const body = await response.json();
  const rows = body.rows ?? body.result?.rows;
  if (!Array.isArray(rows)) throw new Error("SOURCE_SHAPE");
  return rows;
}
async function runLegacySync(sql, source, catalogCodes) {
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
  const admin = createAdminClient({ baseUrl, apiKey });
  const sql = {
    async query(query) {
      const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error("LOCAL_SQL_FAILED");
      const body = await response.json();
      return body.rows ?? body.result?.rows ?? [];
    }
  };
  try {
    const products = await admin.database.from("products").select("code").eq("event_code", "HEX-2026");
    if (products.error) throw new Error("CATALOG_READ_FAILED");
    const catalogCodes = new Set(
      (Array.isArray(products.data) ? products.data : []).map((row) => row.code).filter((code) => typeof code === "string")
    );
    const source = await readSource(enformaUrl.replace(/\/$/, ""), enformaKey);
    const result = await runLegacySync(sql, source, catalogCodes);
    return json(200, { ok: true, result });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "SYNC_FAILED";
    const safe = message.replaceAll("'", "''").slice(0, 300);
    await sql.query(`SELECT public.legacy_sync_apply('{"error":"${safe}"}'::jsonb)`).catch(() => void 0);
    return json(503, { ok: false, error: "SYNC_FAILED" });
  }
}
export {
  handler as default,
  runLegacySync
};
