// insforge/functions/meta-capi-sync/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/meta-capi/event.ts
var MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
function normalizeEmail(value) {
  const email = (value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function normalizePhone(value) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  return null;
}
async function hashIdentifier(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function fbcFromTouch(touch) {
  const fbclid = touch?.fbclid?.trim();
  if (!fbclid || !/^[A-Za-z0-9_-]{1,512}$/.test(fbclid)) return null;
  const clickedAt = Date.parse(touch?.capturedAt ?? "");
  if (!Number.isFinite(clickedAt)) return null;
  return `fb.1.${clickedAt}.${fbclid}`;
}
async function buildPurchaseEvent(ctx, options) {
  const approvedMs = Date.parse(ctx.approvedAt ?? "");
  if (!Number.isFinite(approvedMs)) return { ok: false, reason: "NO_APPROVAL_TIME" };
  if (!(ctx.totalCents > 0)) return { ok: false, reason: "ZERO_VALUE" };
  const nowMs = options.now.getTime();
  if (nowMs - approvedMs > MAX_EVENT_AGE_MS) return { ok: false, reason: "TOO_OLD" };
  const user_data = {
    // Pseudonymous internal id, hashed: keeps the event from being rejected as anonymous.
    external_id: [await hashIdentifier(ctx.buyerContactId)]
  };
  if (options.includeContactData && ctx.contact?.consent) {
    const email = normalizeEmail(ctx.contact.email);
    const phone = normalizePhone(ctx.contact.phone);
    if (email) user_data.em = [await hashIdentifier(email)];
    if (phone) user_data.ph = [await hashIdentifier(phone)];
  }
  const fbc = fbcFromTouch(ctx.touch);
  if (fbc) user_data.fbc = fbc;
  return {
    ok: true,
    event: {
      event_name: "Purchase",
      event_time: Math.floor(Math.min(approvedMs, nowMs) / 1e3),
      event_id: ctx.trackingRef,
      action_source: options.actionSource,
      event_source_url: options.eventSourceUrl,
      user_data,
      custom_data: {
        currency: "MXN",
        value: ctx.totalCents / 100,
        content_ids: ctx.productCodes,
        content_type: "product",
        num_items: ctx.productCodes.length || 1
      }
    }
  };
}

// insforge/functions/_shared/meta-capi/policy.ts
var MAX_ATTEMPTS = 6;
var BASE_BACKOFF_MINUTES = 5;
var MAX_BACKOFF_MINUTES = 120;
function classifyResponse(status) {
  if (status >= 200 && status < 300) return "SENT";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "RETRY";
  return "FAILED";
}
function nextAttemptAt(attempt, now) {
  const minutes = Math.min(BASE_BACKOFF_MINUTES * 2 ** Math.max(attempt - 1, 0), MAX_BACKOFF_MINUTES);
  return new Date(now.getTime() + minutes * 6e4);
}

// insforge/functions/_shared/meta-capi/orchestrate.ts
var BATCH_LIMIT = 25;
var RUN_BUDGET_MS = 2e4;
var MAX_ERROR_LENGTH = 300;
var DEFAULT_SOURCE_URL = "https://hybrid-experience.enforma.mx/";
var DEFAULT_GRAPH_VERSION = "v23.0";
function secretsEqual(expected, actual) {
  let difference = expected.length ^ actual.length;
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (expected.charCodeAt(index) || 0) ^ (actual.charCodeAt(index) || 0);
  }
  return difference === 0;
}
function clean(value) {
  return (value ?? "").trim();
}
function sanitizeError(status, message, token) {
  let text = message;
  if (token) text = text.split(token).join("[redacted]");
  text = text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted]").replace(/\d{9,}/g, "[redacted]");
  return `HTTP ${status}: ${text}`.slice(0, MAX_ERROR_LENGTH);
}
function authorize(req, env2) {
  const secret = clean(env2("META_CAPI_SCHEDULE_SECRET"));
  if (!secret) return { status: 503, body: { status: "error", code: "SCHEDULE_SECRET_NOT_CONFIGURED" } };
  const header = req.headers.get("Authorization");
  if (!header) return { status: 401, body: { status: "error", code: "UNAUTHORIZED" } };
  const match = /^Bearer (.+)$/.exec(header);
  if (!match || !secretsEqual(secret, match[1])) {
    return { status: 403, body: { status: "error", code: "FORBIDDEN" } };
  }
  return null;
}
async function runMetaCapiSync(req, deps) {
  const { env: env2, repo, now, log } = deps;
  const denied = authorize(req, env2);
  if (denied) return denied;
  if (clean(env2("META_CAPI_ENABLED")).toLowerCase() !== "true") {
    return { status: 200, body: { status: "disabled" } };
  }
  const datasetId = clean(env2("META_CAPI_DATASET_ID"));
  const token = clean(env2("META_CAPI_ACCESS_TOKEN"));
  const sinceMs = Date.parse(clean(env2("META_CAPI_SINCE")));
  const missing = [];
  if (!/^\d{5,20}$/.test(datasetId)) missing.push("META_CAPI_DATASET_ID");
  if (!token) missing.push("META_CAPI_ACCESS_TOKEN");
  if (!Number.isFinite(sinceMs)) missing.push("META_CAPI_SINCE");
  if (missing.length > 0) return { status: 503, body: { status: "not_configured", missing } };
  const graphVersion = /^v\d+\.\d+$/.test(clean(env2("META_GRAPH_VERSION"))) ? clean(env2("META_GRAPH_VERSION")) : DEFAULT_GRAPH_VERSION;
  const testEventCode = clean(env2("META_CAPI_TEST_EVENT_CODE"));
  const mode = testEventCode ? "test" : "live";
  const configuredSource = clean(env2("META_CAPI_ACTION_SOURCE"));
  const actionSource = configuredSource === "website" || configuredSource === "other" ? configuredSource : "system_generated";
  const eventSourceUrl = clean(env2("META_CAPI_EVENT_SOURCE_URL")) || DEFAULT_SOURCE_URL;
  const includeContactData = clean(env2("META_CAPI_SEND_CONTACT_DATA")).toLowerCase() === "true";
  const endpoint = `https://graph.facebook.com/${graphVersion}/${datasetId}/events`;
  const startedAt = now().getTime();
  const counts = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  log?.("capi_run_started", { mode });
  const enqueued = await repo.enqueue({ since: new Date(sinceMs).toISOString(), mode });
  const rows = await repo.claim({ limit: BATCH_LIMIT, mode });
  const contexts = rows.length > 0 ? await repo.loadContexts(rows.map((row) => row.orderId)) : /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (now().getTime() - startedAt > RUN_BUDGET_MS) break;
    const base = contexts.get(row.orderId);
    if (!base) {
      await repo.markSkipped(row.id, "ORDER_NOT_FOUND");
      counts.skipped += 1;
      log?.("capi_event_result", { id: row.id, outcome: "SKIPPED", reason: "ORDER_NOT_FOUND" });
      continue;
    }
    const built = await buildPurchaseEvent(
      { ...base, approvedAt: row.approvedAt },
      { eventSourceUrl, actionSource, now: now(), includeContactData }
    );
    if (!built.ok) {
      await repo.markSkipped(row.id, built.reason);
      counts.skipped += 1;
      log?.("capi_event_result", { id: row.id, outcome: "SKIPPED", reason: built.reason });
      continue;
    }
    let status = 0;
    let responseBody = {};
    try {
      const response = await deps.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [built.event],
          access_token: token,
          ...testEventCode ? { test_event_code: testEventCode } : {}
        })
      });
      status = response.status;
      responseBody = await response.json().catch(() => ({}));
    } catch {
      status = 0;
    }
    const outcome = classifyResponse(status);
    const message = typeof responseBody.error?.message === "string" ? responseBody.error.message : "no response";
    const error = sanitizeError(status, message, token);
    if (outcome === "SENT") {
      const trace = typeof responseBody.fbtrace_id === "string" ? responseBody.fbtrace_id : null;
      await repo.markSent(row.id, trace);
      counts.sent += 1;
    } else if (outcome === "RETRY" && row.attempts < MAX_ATTEMPTS) {
      await repo.markRetry(row.id, nextAttemptAt(row.attempts, now()), error);
      counts.retry += 1;
    } else {
      await repo.markFailed(row.id, error);
      counts.failed += 1;
    }
    log?.("capi_event_result", { id: row.id, outcome, status });
  }
  log?.("capi_run_completed", { mode, ...counts });
  return { status: 200, body: { status: "ok", mode, enqueued, claimed: rows.length, ...counts } };
}

// insforge/functions/meta-capi-sync/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function asRows(data) {
  return Array.isArray(data) ? data : [];
}
function touchWithClickId(...touches) {
  for (const touch of touches) {
    if (touch && typeof touch === "object") {
      const record = touch;
      if (typeof record.fbclid === "string" && record.fbclid.trim()) {
        return {
          fbclid: record.fbclid,
          capturedAt: typeof record.capturedAt === "string" ? record.capturedAt : void 0
        };
      }
    }
  }
  return null;
}
function createRepo(admin) {
  const table = () => admin.database.from("meta_capi_outbox");
  async function finish(id, fields) {
    const { error } = await table().update({ ...fields, claimed_until: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) throw new Error("OUTBOX_UPDATE_FAILED");
  }
  return {
    async enqueue(input) {
      const { data, error } = await admin.database.rpc("meta_capi_enqueue_tx", { p: input });
      if (error || !data || typeof data !== "object") throw new Error("ENQUEUE_FAILED");
      return Number(data.enqueued ?? 0);
    },
    async claim(input) {
      const { data, error } = await admin.database.rpc("meta_capi_claim_batch_tx", { p: input });
      if (error || !Array.isArray(data)) throw new Error("CLAIM_FAILED");
      return asRows(data).map(
        (row) => ({
          id: String(row.id),
          orderId: String(row.order_id),
          eventId: String(row.event_id),
          attempts: Number(row.attempts ?? 1),
          approvedAt: typeof row.approved_at === "string" ? row.approved_at : null
        })
      );
    },
    async loadContexts(orderIds) {
      const orders = await admin.database.from("orders").select("id,tracking_ref,total_cents,buyer_contact_id").in("id", orderIds);
      if (orders.error) throw new Error("READ_FAILED");
      const orderRows = asRows(orders.data);
      const buyerIds = [...new Set(orderRows.map((row) => String(row.buyer_contact_id)))];
      const [items, contacts, snapshots] = await Promise.all([
        admin.database.from("order_items").select("order_id,product_code").in("order_id", orderIds),
        admin.database.from("buyer_contacts").select("id,email,phone,contact_consent_at").in("id", buyerIds),
        admin.database.from("order_attribution_snapshots").select("order_id,first_touch,last_touch").in("order_id", orderIds)
      ]);
      if (items.error || contacts.error || snapshots.error) throw new Error("READ_FAILED");
      const codesByOrder = /* @__PURE__ */ new Map();
      for (const row of asRows(items.data)) {
        const list = codesByOrder.get(String(row.order_id)) ?? [];
        if (typeof row.product_code === "string") list.push(row.product_code);
        codesByOrder.set(String(row.order_id), list);
      }
      const contactById = new Map(asRows(contacts.data).map((row) => [String(row.id), row]));
      const snapshotByOrder = new Map(asRows(snapshots.data).map((row) => [String(row.order_id), row]));
      const result = /* @__PURE__ */ new Map();
      for (const order of orderRows) {
        const orderId = String(order.id);
        const contact = contactById.get(String(order.buyer_contact_id));
        const snapshot = snapshotByOrder.get(orderId);
        result.set(orderId, {
          orderId,
          trackingRef: String(order.tracking_ref ?? ""),
          totalCents: Number(order.total_cents ?? 0),
          productCodes: codesByOrder.get(orderId) ?? [],
          buyerContactId: String(order.buyer_contact_id),
          contact: contact ? {
            email: typeof contact.email === "string" ? contact.email : null,
            phone: typeof contact.phone === "string" ? contact.phone : null,
            consent: contact.contact_consent_at != null
          } : null,
          touch: touchWithClickId(snapshot?.last_touch, snapshot?.first_touch)
        });
      }
      return result;
    },
    markSent: (id, fbtraceId) => finish(id, { status: "SENT", sent_at: (/* @__PURE__ */ new Date()).toISOString(), fbtrace_id: fbtraceId, last_error: null }),
    markRetry: (id, nextAttempt, error) => finish(id, { status: "RETRY", next_attempt_at: nextAttempt.toISOString(), last_error: error }),
    markFailed: (id, error) => finish(id, { status: "FAILED", last_error: error }),
    markSkipped: (id, reason) => finish(id, { status: "SKIPPED", skip_reason: reason })
  };
}
async function handler(req) {
  if (req.method !== "POST") return jsonResponse(405, { status: "error", code: "METHOD_NOT_ALLOWED" });
  try {
    const baseUrl = env("INSFORGE_BASE_URL");
    const apiKey = env("API_KEY");
    if (!baseUrl || !apiKey) return jsonResponse(503, { status: "error", code: "BACKEND_NOT_CONFIGURED" });
    const result = await runMetaCapiSync(req, {
      env,
      repo: createRepo(createAdminClient({ baseUrl, apiKey })),
      fetch,
      now: () => /* @__PURE__ */ new Date(),
      // Counts and opaque ids only: no tokens, emails or phones ever reach logs.
      log: (event, fields) => console.log(JSON.stringify({ event, ...fields }))
    });
    return jsonResponse(result.status, result.body);
  } catch {
    return jsonResponse(500, { status: "error", code: "INTERNAL_ERROR" });
  }
}
export {
  handler as default
};
