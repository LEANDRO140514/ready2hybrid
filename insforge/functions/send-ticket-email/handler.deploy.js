// insforge/functions/send-ticket-email/index.ts
import { createAdminClient } from "npm:@insforge/sdk@1.5.0";

// insforge/functions/_shared/email/errors.ts
var STATUS = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  ORDER_NOT_FOUND: 404,
  BUYER_EMAIL_MISSING: 422,
  EMAIL_NOT_CONFIGURED: 503,
  EMAIL_SEND_FAILED: 502,
  CONFIGURATION_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500
};
var SendTicketEmailError = class extends Error {
  code;
  status;
  constructor(code, message) {
    super(message ?? code);
    this.name = "SendTicketEmailError";
    this.code = code;
    this.status = STATUS[code];
  }
  toPublicBody() {
    return { error: this.code };
  }
};

// insforge/functions/_shared/email/config.ts
function loadSendTicketEmailRuntimeConfig(env2) {
  const ttlRaw = env2("TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS") ?? "3600";
  const ttl = Number.parseInt(ttlRaw, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new SendTicketEmailError("CONFIGURATION_ERROR", "Invalid TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS");
  }
  return {
    operatorBearer: env2("TICKET_OPERATOR_BEARER") ?? null,
    resendApiKey: env2("RESEND_API_KEY") ?? null,
    idempotencyTtlSeconds: ttl
  };
}

// insforge/functions/_shared/email/pdf.ts
import { jsPDF } from "npm:jspdf@3.0.1";
import QRCode from "npm:qrcode@1.5.4";
async function generateTicketPdf(input) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  doc.setFillColor(0, 51, 102);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("HYBRID EXPERIENCE", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("by ENFORMA", pageWidth / 2, 28, { align: "center" });
  const qrDataUrl = await QRCode.toDataURL(input.rawToken, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480
  });
  const qrSize = 45;
  doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, 45, qrSize, qrSize);
  doc.setTextColor(0, 0, 0);
  let y = 55;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Boleto de Entrada", margin, y);
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setFont("helvetica", "bold");
  doc.text("Categor\xEDa:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.productName, margin + 28, y);
  y += 8;
  if (input.teamName) {
    doc.setFont("helvetica", "bold");
    doc.text("Equipo:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(input.teamName, margin + 28, y);
    y += 8;
  }
  const participantLabel = input.rosterNames.length > 1 ? "Participantes:" : "Participante:";
  doc.setFont("helvetica", "bold");
  doc.text(participantLabel, margin, y);
  doc.setFont("helvetica", "normal");
  const namesText = input.rosterNames.join(", ");
  const maxWidth = pageWidth - margin * 2 - qrSize - 10;
  const splitNames = doc.splitTextToSize(namesText, maxWidth);
  doc.text(splitNames, margin + 32, y);
  y += splitNames.length * 6 + 4;
  doc.setFont("helvetica", "bold");
  doc.text("Referencia:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.ticketFolio, margin + 28, y);
  y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const eventInfo = [
    "13, 14 y 15 de noviembre de 2026",
    "M\xE9rida, Yucat\xE1n",
    "",
    "Presenta este c\xF3digo QR en el acceso al evento."
  ];
  for (const line of eventInfo) {
    doc.text(line, margin, y);
    y += 6;
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Este boleto es personal e intransferible.", margin, 280);
  return doc.output("datauristring").split(",")[1];
}
function buildEmailHtml(input) {
  const teamLine = input.teamName ? `<p><strong>Equipo:</strong> ${escapeHtml(input.teamName)}</p>` : "";
  const participantLabel = input.rosterNames.length > 1 ? "Participantes" : "Participante";
  const rosterText = input.rosterNames.map(escapeHtml).join(", ");
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Confirmaci\xF3n de inscripci\xF3n</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Estimado/a ${escapeHtml(input.buyerName)}:</p>

  <p>Confirmamos tu inscripci\xF3n a Hybrid Experience 2026, que se celebrar\xE1 los d\xEDas 13, 14 y 15 de noviembre de 2026 en M\xE9rida, Yucat\xE1n.</p>

  <p><strong>Categor\xEDa:</strong> ${escapeHtml(input.productName)}</p>
  ${teamLine}
  <p><strong>${participantLabel}:</strong> ${rosterText}</p>
  <p><strong>Referencia:</strong> ${escapeHtml(input.ticketFolio)}</p>

  <p>Adjuntamos tu boleto en formato PDF. En \xE9l encontrar\xE1s un c\xF3digo QR que deber\xE1s presentar en el acceso al evento para validar tu entrada.</p>

  <p>Te recomendamos conservar este correo y llevar el boleto contigo, impreso o en tu dispositivo, el d\xEDa del evento.</p>

  <p>Para cualquier aclaraci\xF3n, cont\xE1ctanos por nuestros canales oficiales.</p>

  <p style="margin-top: 30px;">
    <strong>Hybrid Experience</strong><br>
    <em>by ENFORMA</em>
  </p>
</body>
</html>`;
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// insforge/functions/_shared/email/orchestrate.ts
async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function requireOperator(req, bearer) {
  if (!bearer) throw new SendTicketEmailError("CONFIGURATION_ERROR");
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${bearer}`) {
    throw new SendTicketEmailError("UNAUTHORIZED");
  }
}
function parseRequest(raw) {
  if (!raw || typeof raw !== "object") {
    throw new SendTicketEmailError("INVALID_REQUEST");
  }
  const obj = raw;
  if (obj.mode === "sweep") {
    const max = typeof obj.max === "number" && obj.max > 0 ? Math.min(obj.max, 100) : 25;
    return { mode: "sweep", max };
  }
  if (obj.mode === "status") {
    if (typeof obj.order_id !== "string" || !obj.order_id.trim()) {
      throw new SendTicketEmailError("INVALID_REQUEST");
    }
    return { mode: "status", orderId: obj.order_id.trim() };
  }
  if (typeof obj.order_id === "string" && obj.order_id.trim()) {
    return { mode: "send", orderId: obj.order_id.trim() };
  }
  throw new SendTicketEmailError("INVALID_REQUEST");
}
async function sendForOrder(orderId, deps, config) {
  const admin = deps.getAdminClient();
  const { data: registrationsRaw, error: regErr } = await admin.database.from("registrations").select("id, product_id, team_id").eq("order_id", orderId).limit(100);
  if (regErr || !registrationsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const registrations = registrationsRaw;
  if (registrations.length === 0) {
    return { ok: true, sent: 0, reason: "NO_REGISTRATIONS" };
  }
  const registrationIds = registrations.map((r) => r.id);
  const { data: ticketsRaw, error: ticketsErr } = await admin.database.from("tickets").select("id, folio, registration_id, product_code").in("registration_id", registrationIds);
  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const ticketRows = ticketsRaw;
  if (ticketRows.length === 0) {
    return { ok: true, sent: 0, reason: "NO_TICKETS" };
  }
  const ticketDomainRefs = ticketRows.map((t) => `ticket:${t.id}`);
  const { data: outboxRaw } = await admin.database.from("outbox_delivery_jobs").select("domain_event_ref, state").in("domain_event_ref", ticketDomainRefs);
  const outboxJobs = outboxRaw ?? [];
  const alreadySentRefs = new Set(
    outboxJobs.filter((j) => j.state === "SENT").map((j) => j.domain_event_ref)
  );
  const pendingTicketRows = ticketRows.filter((t) => !alreadySentRefs.has(`ticket:${t.id}`));
  if (pendingTicketRows.length === 0) {
    return { ok: true, sent: 0, reason: "ALL_ALREADY_SENT" };
  }
  const productIds = [...new Set(registrations.map((r) => r.product_id))];
  const { data: productsRaw, error: productsErr } = await admin.database.from("products").select("id, name, team_size").in("id", productIds);
  if (productsErr || !productsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const products = productsRaw;
  const productMap = new Map(products.map((p) => [p.id, p]));
  const regToProduct = /* @__PURE__ */ new Map();
  for (const reg of registrations) {
    regToProduct.set(reg.id, productMap.get(reg.product_id));
  }
  const regToTeamId = /* @__PURE__ */ new Map();
  for (const reg of registrations) {
    regToTeamId.set(reg.id, reg.team_id);
  }
  const { data: orderData, error: orderErr } = await admin.database.from("orders").select("id, buyer_contact_id").eq("id", orderId).single();
  if (orderErr || !orderData) {
    throw new SendTicketEmailError("ORDER_NOT_FOUND");
  }
  const order = orderData;
  const { data: buyerData, error: buyerErr } = await admin.database.from("buyer_contacts").select("id, email, name").eq("id", order.buyer_contact_id).single();
  if (buyerErr || !buyerData) {
    throw new SendTicketEmailError("ORDER_NOT_FOUND");
  }
  const buyer = buyerData;
  const buyerEmail = buyer.email;
  const buyerName = buyer.name ?? "Participante";
  if (!buyerEmail) {
    const results = [];
    for (const t of pendingTicketRows) {
      await markOutboxResult(admin, t.id, "BUYER_EMAIL_MISSING");
      results.push({ ticket_id: t.id, status: "FAILED", detail: "BUYER_EMAIL_MISSING" });
    }
    return { ok: false, sent: 0, failed: pendingTicketRows.length, results, error: "BUYER_EMAIL_MISSING" };
  }
  if (!config.resendApiKey) {
    throw new SendTicketEmailError("EMAIL_NOT_CONFIGURED");
  }
  const teamIds = [...new Set(registrations.map((r) => r.team_id).filter((id) => id != null))];
  const teamNameMap = /* @__PURE__ */ new Map();
  const teamRosterMap = /* @__PURE__ */ new Map();
  if (teamIds.length > 0) {
    const { data: teamsRaw } = await admin.database.from("teams").select("id, name").in("id", teamIds);
    const teams = teamsRaw ?? [];
    for (const t of teams) {
      teamNameMap.set(t.id, t.name);
    }
    const { data: membersRaw } = await admin.database.from("team_members").select("team_id, participant_id, position").in("team_id", teamIds);
    const members = membersRaw ?? [];
    const participantIds = [...new Set(members.map((m) => m.participant_id))];
    let participantNameMap = /* @__PURE__ */ new Map();
    if (participantIds.length > 0) {
      const { data: participantsRaw } = await admin.database.from("participants").select("id, name").in("id", participantIds);
      const participants = participantsRaw ?? [];
      participantNameMap = new Map(participants.map((p) => [p.id, p.name]));
    }
    for (const teamId of teamIds) {
      const teamMembers = members.filter((m) => m.team_id === teamId).sort((a, b) => a.position - b.position);
      const names = teamMembers.map((m) => participantNameMap.get(m.participant_id)).filter((n) => Boolean(n));
      teamRosterMap.set(teamId, names.length > 0 ? names : [buyerName]);
    }
  }
  const resolvedTickets = [];
  for (const t of pendingTicketRows) {
    const product = regToProduct.get(t.registration_id);
    const teamId = regToTeamId.get(t.registration_id);
    const teamSize = product?.team_size ?? 1;
    const productName = product?.name ?? t.product_code;
    let teamName = null;
    let rosterNames = [buyerName];
    if (teamId) {
      teamName = teamNameMap.get(teamId) ?? null;
      rosterNames = teamRosterMap.get(teamId) ?? [buyerName];
    }
    resolvedTickets.push({
      id: t.id,
      folio: t.folio,
      registrationId: t.registration_id,
      productCode: t.product_code,
      productName,
      teamSize,
      teamId,
      teamName,
      rosterNames
    });
  }
  const attachments = [];
  const failedResults = [];
  for (const ticket of resolvedTickets) {
    const uniqueSeed = `email:${ticket.id}:${Date.now()}:${crypto.randomUUID()}`;
    const idempotencyKeyHash = await sha256Hex(uniqueSeed);
    const requestFingerprint = await sha256Hex(JSON.stringify({ ticket_id: ticket.id, send_ts: Date.now() }));
    const { data: reissueData, error: reissueErr } = await admin.database.rpc(
      "ticket_credential_reissue_tx",
      {
        p: {
          ticket_id: ticket.id,
          idempotency_key_hash: idempotencyKeyHash,
          request_fingerprint: requestFingerprint,
          idempotency_ttl_seconds: config.idempotencyTtlSeconds
        }
      }
    );
    if (reissueErr) {
      await markOutboxResult(admin, ticket.id, "REISSUE_RPC_ERROR");
      failedResults.push({ ticket_id: ticket.id, status: "FAILED", detail: "REISSUE_RPC_ERROR" });
      continue;
    }
    const reissue = reissueData;
    if (!reissue?.ok) {
      const errCode = reissue?.error_code ?? "REISSUE_FAILED";
      await markOutboxResult(admin, ticket.id, errCode);
      failedResults.push({ ticket_id: ticket.id, status: "FAILED", detail: errCode });
      continue;
    }
    const rawToken = reissue.response?.raw_token;
    if (!rawToken) {
      await markOutboxResult(admin, ticket.id, "NO_RAW_TOKEN");
      failedResults.push({ ticket_id: ticket.id, status: "FAILED", detail: "NO_RAW_TOKEN" });
      continue;
    }
    try {
      const pdfBase64 = await generateTicketPdf({
        ticketFolio: ticket.folio,
        productName: ticket.productName,
        teamName: ticket.teamName,
        rosterNames: ticket.rosterNames,
        buyerName,
        rawToken
      });
      const filename = resolvedTickets.length > 1 ? `boleto-${ticket.folio}.pdf` : "boleto-hybrid-experience.pdf";
      attachments.push({ ticketId: ticket.id, filename, content: pdfBase64 });
    } catch {
      await markOutboxResult(admin, ticket.id, "PDF_GENERATION_FAILED");
      failedResults.push({ ticket_id: ticket.id, status: "FAILED", detail: "PDF_GENERATION_FAILED" });
    }
  }
  if (attachments.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: failedResults.length,
      results: failedResults,
      error: "NO_ATTACHMENTS_GENERATED"
    };
  }
  const firstTicket = resolvedTickets.find((t) => attachments.some((a) => a.ticketId === t.id));
  const emailHtml = buildEmailHtml({
    buyerName,
    productName: firstTicket.productName,
    teamName: firstTicket.teamName,
    rosterNames: firstTicket.rosterNames,
    ticketFolio: firstTicket.folio
  });
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.resendApiKey}`
    },
    body: JSON.stringify({
      from: "HYBRID EXPERIENCE <boletos@mail.hybrid-experience.enforma.mx>",
      to: buyerEmail,
      subject: "Confirmaci\xF3n de inscripci\xF3n \u2014 Hybrid Experience 2026",
      html: emailHtml,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content
      }))
    })
  });
  if (!resendResponse.ok) {
    const errText = await resendResponse.text().catch(() => "unknown");
    const errorDetail = `RESEND_ERROR:${resendResponse.status}`;
    for (const att of attachments) {
      await markOutboxResult(admin, att.ticketId, errorDetail);
    }
    const allResults = [
      ...failedResults,
      ...attachments.map((a) => ({
        ticket_id: a.ticketId,
        status: "FAILED",
        detail: "RESEND_FAILED"
      }))
    ];
    return {
      ok: false,
      sent: 0,
      failed: allResults.length,
      results: allResults,
      error: `${errorDetail}:${errText.slice(0, 100)}`
    };
  }
  const resendResult = await resendResponse.json();
  const resendId = resendResult.id ?? "ok";
  for (const att of attachments) {
    await admin.database.from("outbox_delivery_jobs").update({ state: "SENT", result: resendId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("domain_event_ref", `ticket:${att.ticketId}`).neq("state", "SENT");
  }
  const successResults = attachments.map((a) => ({
    ticket_id: a.ticketId,
    status: "SENT"
  }));
  return {
    ok: true,
    orders: 1,
    sent: attachments.length,
    failed: failedResults.length,
    results: [...successResults, ...failedResults]
  };
}
async function markOutboxResult(admin, ticketId, result) {
  await admin.database.from("outbox_delivery_jobs").update({ result, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("domain_event_ref", `ticket:${ticketId}`).neq("state", "SENT");
}
async function sweepPending(max, deps, config) {
  const admin = deps.getAdminClient();
  const { data: jobsRaw, error: jobsErr } = await admin.database.from("outbox_delivery_jobs").select("domain_event_ref").eq("communication_type", "TICKET_READY").eq("state", "PENDING").limit(max * 2);
  if (jobsErr || !jobsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const jobs = jobsRaw;
  const ticketIds = jobs.map((j) => {
    const match = /^ticket:(.+)$/.exec(j.domain_event_ref);
    return match?.[1];
  }).filter((id) => Boolean(id));
  if (ticketIds.length === 0) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] };
  }
  const { data: ticketsRaw } = await admin.database.from("tickets").select("id, registration_id").in("id", ticketIds);
  if (!ticketsRaw) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] };
  }
  const tickets = ticketsRaw;
  const registrationIds = [...new Set(tickets.map((t) => t.registration_id))];
  const { data: regsRaw } = await admin.database.from("registrations").select("id, order_id").in("id", registrationIds);
  if (!regsRaw) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] };
  }
  const regs = regsRaw;
  const orderIds = [...new Set(regs.map((r) => r.order_id))];
  const limitedOrderIds = orderIds.slice(0, max);
  let totalSent = 0;
  let totalFailed = 0;
  const allResults = [];
  for (const oid of limitedOrderIds) {
    try {
      const result = await sendForOrder(oid, deps, config);
      totalSent += result.sent ?? 0;
      totalFailed += result.failed ?? 0;
      if (result.results) {
        allResults.push(...result.results);
      }
    } catch {
      totalFailed++;
    }
  }
  return {
    ok: true,
    orders: limitedOrderIds.length,
    sent: totalSent,
    failed: totalFailed,
    results: allResults
  };
}
async function statusForOrder(orderId, deps) {
  const admin = deps.getAdminClient();
  const { data: regsRaw, error: regsErr } = await admin.database.from("registrations").select("id").eq("order_id", orderId).limit(100);
  if (regsErr || !regsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const regs = regsRaw;
  if (regs.length === 0) {
    return { ok: true, sent: 0, reason: "NO_REGISTRATIONS", results: [] };
  }
  const registrationIds = regs.map((r) => r.id);
  const { data: ticketsRaw, error: ticketsErr } = await admin.database.from("tickets").select("id, folio, registration_id").in("registration_id", registrationIds);
  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError("SERVICE_UNAVAILABLE");
  }
  const tickets = ticketsRaw;
  if (tickets.length === 0) {
    return { ok: true, sent: 0, reason: "NO_TICKETS", results: [] };
  }
  const ticketIds = tickets.map((t) => t.id);
  const ticketDomainRefs = ticketIds.map((id) => `ticket:${id}`);
  const { data: jobsRaw } = await admin.database.from("outbox_delivery_jobs").select("domain_event_ref, state, result").in("domain_event_ref", ticketDomainRefs);
  const jobs = jobsRaw ?? [];
  const jobMap = new Map(jobs.map((j) => [j.domain_event_ref, j]));
  const results = tickets.map((t) => {
    const job = jobMap.get(`ticket:${t.id}`);
    if (!job) {
      return { ticket_id: t.id, status: "SKIPPED", detail: "NO_OUTBOX_JOB" };
    }
    return {
      ticket_id: t.id,
      status: job.state === "SENT" ? "SENT" : "FAILED",
      detail: job.result ?? job.state
    };
  });
  const sent = results.filter((r) => r.status === "SENT").length;
  return { ok: true, sent, failed: results.length - sent, results };
}
async function orchestrateSendTicketEmail(req, deps) {
  if (req.method !== "POST") {
    throw new SendTicketEmailError("METHOD_NOT_ALLOWED");
  }
  const config = loadSendTicketEmailRuntimeConfig(deps.env);
  requireOperator(req, config.operatorBearer);
  let raw;
  try {
    raw = await req.json();
  } catch {
    throw new SendTicketEmailError("INVALID_REQUEST");
  }
  const parsed = parseRequest(raw);
  if (parsed.mode === "status") {
    const result2 = await statusForOrder(parsed.orderId, deps);
    return { status: 200, body: result2 };
  }
  if (parsed.mode === "sweep") {
    const result2 = await sweepPending(parsed.max, deps, config);
    return { status: 200, body: result2 };
  }
  const result = await sendForOrder(parsed.orderId, deps, config);
  return { status: result.ok ? 200 : 422, body: result };
}

// insforge/functions/send-ticket-email/index.ts
function env(key) {
  return Deno.env.get(key) ?? void 0;
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
function createLazyAdminClient() {
  let client = null;
  return function getAdminClient() {
    if (client) return client;
    const baseUrl = env("INSFORGE_BASE_URL");
    const apiKey = env("API_KEY");
    if (!baseUrl || !apiKey) {
      throw new SendTicketEmailError("CONFIGURATION_ERROR");
    }
    client = createAdminClient({ baseUrl, apiKey });
    return client;
  };
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  try {
    const result = await orchestrateSendTicketEmail(req, {
      env,
      getAdminClient: createLazyAdminClient()
    });
    return jsonResponse(result.status, result.body);
  } catch (error) {
    if (error instanceof SendTicketEmailError) {
      return jsonResponse(error.status, error.toPublicBody());
    }
    return jsonResponse(500, new SendTicketEmailError("INTERNAL_ERROR").toPublicBody());
  }
}
export {
  handler as default
};
