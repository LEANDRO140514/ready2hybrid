// insforge/functions/ticket-credentials/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/tickets/config.ts
function loadTicketCredentialRuntimeConfig(env2) {
  const ttlRaw = env2("TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS") ?? "3600";
  const ttl = Number.parseInt(ttlRaw, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("CONFIGURATION_ERROR");
  }
  return {
    corsOrigin: env2("TICKET_CREDENTIAL_CORS_ORIGIN") ?? null,
    idempotencyTtlSeconds: ttl,
    operatorBearer: env2("TICKET_OPERATOR_BEARER") ?? null
  };
}

// insforge/functions/_shared/tickets/errors.ts
var STATUS = {
  INVALID_REQUEST: 400,
  INVALID_TOKEN: 400,
  TICKET_NOT_FOUND: 404,
  CREDENTIAL_NOT_FOUND: 404,
  TICKET_REVOKED: 409,
  NO_ACTIVE_CREDENTIAL: 409,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  METHOD_NOT_ALLOWED: 405,
  CONFIGURATION_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  PUBLIC_TICKET_RETRIEVAL_DEFERRED: 403
};
var TicketCredentialError = class extends Error {
  code;
  status;
  constructor(code, message) {
    super(message ?? code);
    this.name = "TicketCredentialError";
    this.code = code;
    this.status = STATUS[code];
  }
  toPublicBody() {
    return { error: this.code };
  }
};
function mapRpcError(code) {
  switch (code) {
    case "INVALID_REQUEST":
    case "INVALID_TOKEN":
    case "TICKET_NOT_FOUND":
    case "CREDENTIAL_NOT_FOUND":
    case "TICKET_REVOKED":
    case "NO_ACTIVE_CREDENTIAL":
    case "CONFLICT":
    case "CONFIGURATION_ERROR":
      return new TicketCredentialError(code);
    default:
      return new TicketCredentialError("INTERNAL_ERROR");
  }
}

// insforge/functions/_shared/tickets/hash.ts
async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// insforge/functions/_shared/tickets/validate.ts
var QR_TOKEN_PATTERN = /^qr_[0-9a-f]{32}$/;
function parseQrToken(raw) {
  if (raw == null || typeof raw !== "string" || !QR_TOKEN_PATTERN.test(raw)) {
    throw new TicketCredentialError("INVALID_TOKEN");
  }
  return raw;
}
function parseTicketId(raw) {
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) {
    throw new TicketCredentialError("INVALID_REQUEST");
  }
  return raw;
}
function parseReissueRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TicketCredentialError("INVALID_REQUEST");
  }
  const record = body;
  const allowed = /* @__PURE__ */ new Set(["ticket_id", "idempotency_key", "action"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TicketCredentialError("INVALID_REQUEST");
  }
  if (record.action !== void 0 && record.action !== "reissue") {
    throw new TicketCredentialError("INVALID_REQUEST");
  }
  const ticketId = parseTicketId(record.ticket_id);
  if (typeof record.idempotency_key !== "string" || record.idempotency_key.length < 8) {
    throw new TicketCredentialError("INVALID_REQUEST");
  }
  return { ticketId, idempotencyKey: record.idempotency_key };
}

// insforge/functions/_shared/tickets/orchestrate.ts
function requireOperator(req, bearer) {
  if (!bearer) throw new TicketCredentialError("CONFIGURATION_ERROR");
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${bearer}`) {
    throw new TicketCredentialError("UNAUTHORIZED");
  }
}
async function orchestrateTicketCredentials(req, deps) {
  if (req.method !== "GET" && req.method !== "POST") {
    throw new TicketCredentialError("METHOD_NOT_ALLOWED");
  }
  let config;
  try {
    config = loadTicketCredentialRuntimeConfig(deps.env);
  } catch {
    throw new TicketCredentialError("CONFIGURATION_ERROR");
  }
  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "verify") {
      requireOperator(req, config.operatorBearer);
      const token = parseQrToken(url.searchParams.get("token"));
      const result2 = await deps.repo.verifyToken({ token });
      if (!result2.ok) throw mapRpcError(result2.error_code);
      return { status: 200, body: result2.body };
    }
    if (action === "projection") {
      requireOperator(req, config.operatorBearer);
      const ticketId = parseTicketId(url.searchParams.get("ticket_id"));
      const result2 = await deps.repo.getProjection({ ticketId });
      if (!result2.ok) throw mapRpcError(result2.error_code);
      return { status: 200, body: result2.projection };
    }
    throw new TicketCredentialError("PUBLIC_TICKET_RETRIEVAL_DEFERRED");
  }
  requireOperator(req, config.operatorBearer);
  let raw;
  try {
    raw = await req.json();
  } catch {
    throw new TicketCredentialError("INVALID_REQUEST");
  }
  const parsed = parseReissueRequest(raw);
  const idempotencyKeyHash = await sha256Hex(parsed.idempotencyKey);
  const requestFingerprint = await sha256Hex(JSON.stringify({ ticket_id: parsed.ticketId }));
  const result = await deps.repo.reissue({
    ticketId: parsed.ticketId,
    idempotencyKeyHash,
    requestFingerprint,
    idempotencyTtlSeconds: config.idempotencyTtlSeconds
  });
  if (!result.ok) throw mapRpcError(result.error_code);
  return {
    status: 200,
    body: {
      replay: result.replay,
      ...result.response
    }
  };
}

// insforge/functions/ticket-credentials/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function baseHeaders() {
  const config = loadTicketCredentialRuntimeConfig(env);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key"
  };
  if (config.corsOrigin) {
    headers["Access-Control-Allow-Origin"] = config.corsOrigin;
    headers["Vary"] = "Origin";
  }
  return headers;
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders() });
}
function createLazyRepo() {
  let client = null;
  function getClient() {
    if (client) return client;
    const baseUrl = env("INSFORGE_BASE_URL");
    const apiKey = env("API_KEY");
    if (!baseUrl || !apiKey) {
      throw new TicketCredentialError("CONFIGURATION_ERROR");
    }
    client = createAdminClient({ baseUrl, apiKey });
    return client;
  }
  return {
    async verifyToken(input) {
      const admin = getClient();
      const { data, error } = await admin.database.rpc("ticket_credential_verify_tx", {
        p: { token: input.token }
      });
      if (error) throw new TicketCredentialError("SERVICE_UNAVAILABLE");
      const row = data;
      if (!row?.ok) {
        return { ok: false, error_code: String(row?.error_code ?? "INTERNAL_ERROR") };
      }
      return { ok: true, body: row };
    },
    async getProjection(input) {
      const admin = getClient();
      const { data, error } = await admin.database.rpc("ticket_get_projection_tx", {
        p: { ticket_id: input.ticketId }
      });
      if (error) throw new TicketCredentialError("SERVICE_UNAVAILABLE");
      const row = data;
      if (!row?.ok) {
        return { ok: false, error_code: String(row?.error_code ?? "INTERNAL_ERROR") };
      }
      return {
        ok: true,
        projection: row.projection ?? {}
      };
    },
    async reissue(input) {
      const admin = getClient();
      const { data, error } = await admin.database.rpc("ticket_credential_reissue_tx", {
        p: {
          ticket_id: input.ticketId,
          idempotency_key_hash: input.idempotencyKeyHash,
          request_fingerprint: input.requestFingerprint,
          idempotency_ttl_seconds: input.idempotencyTtlSeconds
        }
      });
      if (error) throw new TicketCredentialError("SERVICE_UNAVAILABLE");
      const row = data;
      if (!row?.ok) {
        return { ok: false, error_code: String(row?.error_code ?? "INTERNAL_ERROR") };
      }
      if (row.replay) {
        return {
          ok: true,
          replay: true,
          response: row.prior_response ?? {}
        };
      }
      return {
        ok: true,
        replay: false,
        response: row.response ?? {}
      };
    }
  };
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseHeaders() });
  }
  try {
    const result = await orchestrateTicketCredentials(req, {
      env,
      repo: createLazyRepo()
    });
    return jsonResponse(result.status, result.body);
  } catch (error) {
    if (error instanceof TicketCredentialError) {
      return jsonResponse(error.status, error.toPublicBody());
    }
    return jsonResponse(500, new TicketCredentialError("INTERNAL_ERROR").toPublicBody());
  }
}
export {
  handler as default
};
