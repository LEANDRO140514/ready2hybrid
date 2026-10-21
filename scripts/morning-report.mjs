// "Buenos días del sistema" — daily READ-ONLY operations report for HEX-2026.
//
// Usage:  npm run morning-report
// Output: %USERPROFILE%\Documents\hybrid-reportes\YYYY-MM-DD.md  (+ printed to stdout)
//
// Safety contract:
//  - Production access goes only through the already-authenticated InsForge CLI
//    (`db query` with SELECT-only statements, `logs`, `functions list|code`).
//  - Never writes data, deploys, resends tickets, or prints secrets / personal data
//    (only counts, amounts, and 8-char order id prefixes).
//  - The InsForge CLI needs a directory with .insforge/project.json: INSFORGE_CWD,
//    else the directory npm was invoked from (INIT_CWD), else the current directory.
//    That same directory is used for git/gh, so it must be a checkout of ready2hybrid.
import { exec, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** America/Merida is UTC-6 all year (no DST). */
const MERIDA_OFFSET_MS = -6 * HOUR_MS
const LANDING_REPO = 'LEANDRO140514/hybrid-event-landing'

const merida = (y, m, d, hh = 0, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh, mm) - MERIDA_OFFSET_MS)

/** Commercial calendar (SPEC-030 v0.4.x). Stage windows are half-open [start, end). */
export const CALENDAR = {
  presaleStart: merida(2026, 9, 25),
  presaleEnd: merida(2026, 10, 27), // Preventa through 26-oct 23:59
  salesClose: merida(2026, 11, 13, 11, 0), // Regular through 13-nov 11:00
  kitDelivery: merida(2026, 11, 12, 17, 0),
  eventStart: merida(2026, 11, 13),
}

const STAGE_LABEL = { LAUNCH: 'Lanzamiento', PRESALE: 'Preventa', REGULAR: 'Regular' }

/** Stage that the calendar says applies at `date` (after close only spectator passes sell, at REGULAR). */
export function expectedStage(date) {
  const t = date.getTime()
  if (t < CALENDAR.presaleStart.getTime()) return 'LAUNCH'
  if (t < CALENDAR.presaleEnd.getTime()) return 'PRESALE'
  return 'REGULAR'
}

// ---------------------------------------------------------------- formatting helpers

const pad = (n) => String(n).padStart(2, '0')

export function fmtMerida(date) {
  const d = new Date(date.getTime() + MERIDA_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export const dateKey = (date) => fmtMerida(date).slice(0, 10)

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (cents) => `$${moneyFmt.format((Number(cents) || 0) / 100)}`
const num = (v) => Number(v) || 0

export function countdown(now, target) {
  const diff = target.getTime() - now.getTime()
  const abs = Math.abs(diff)
  const days = Math.floor(abs / DAY_MS)
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS)
  const text = `${days} d ${hours} h`
  return diff >= 0 ? text : `ya pasó (hace ${text})`
}

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`
  return [head, sep, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
}

const warn = (msg) => `⚠️ n/d — ${msg}`

// ---------------------------------------------------------------- log parsing

const ANSI = /\u001b\[[0-9;]*m/g
const clean = (text) => String(text ?? '').replace(ANSI, '').replace(/\s+/g, ' ').trim()

/** function.logs line: `POST mp-webhook 200 123ms` */
export function parseFunctionLogLine(message) {
  const m = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) ([a-z0-9-]+) (\d{3}) \d+ms/i.exec(clean(message))
  return m ? { method: m[1].toUpperCase(), slug: m[2], status: Number(m[3]) } : null
}

/** insforge.logs gateway line: `POST /functions/mp-webhook 401 23 12ms - <ip> - <user-agent>` (ip is dropped) */
export function parseGatewayLogLine(message) {
  const m = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) \/functions\/([a-z0-9-]+) (\d{3}) \d+ \d+ms - \S+ - (.*)$/i.exec(
    clean(message),
  )
  return m ? { method: m[1].toUpperCase(), slug: m[2], status: Number(m[3]), userAgent: m[4] } : null
}

export function classifyWebhookType(userAgent) {
  const ua = String(userAgent ?? '')
  if (/feed/i.test(ua)) return 'Feed v2.0'
  if (/v1\.0/i.test(ua)) return 'v1.0'
  return 'otro'
}

function inWindow(entry, now) {
  const t = Date.parse(entry.timestamp)
  return Number.isFinite(t) && t >= now.getTime() - DAY_MS && t <= now.getTime() + HOUR_MS
}

/** Per-function calls / 4xx / 5xx from function.logs entries ({timestamp,eventMessage}). */
export function summarizeFunctionLogs(entries, now) {
  const perFn = {}
  let oldest = null
  for (const entry of entries) {
    const t = Date.parse(entry.timestamp)
    if (Number.isFinite(t) && (oldest === null || t < oldest)) oldest = t
    if (!inWindow(entry, now)) continue
    const parsed = parseFunctionLogLine(entry.eventMessage)
    if (!parsed) continue
    const row = (perFn[parsed.slug] ??= { calls: 0, c4xx: 0, c5xx: 0 })
    row.calls += 1
    if (parsed.status >= 500) row.c5xx += 1
    else if (parsed.status >= 400) row.c4xx += 1
  }
  return { perFn, windowHours: oldest === null ? 0 : Math.min(24, (now.getTime() - oldest) / HOUR_MS), entries: entries.length }
}

/** mp-webhook gateway rejections (>=400) by webhook type. */
export function summarizeGatewayWebhook(entries, now) {
  const rejected = { 'v1.0': 0, 'Feed v2.0': 0, otro: 0 }
  let oldest = null
  for (const entry of entries) {
    const t = Date.parse(entry.timestamp)
    if (Number.isFinite(t) && (oldest === null || t < oldest)) oldest = t
    if (!inWindow(entry, now)) continue
    const parsed = parseGatewayLogLine(entry.eventMessage)
    if (!parsed || parsed.slug !== 'mp-webhook' || parsed.status < 400) continue
    rejected[classifyWebhookType(parsed.userAgent)] += 1
  }
  return { rejected, windowHours: oldest === null ? 0 : Math.min(24, (now.getTime() - oldest) / HOUR_MS) }
}

// ---------------------------------------------------------------- alerts

const WATCHED_5XX = ['mp-create-checkout', 'mp-webhook', 'send-ticket-email']
const val = (section) => (section && !section.error ? section.value : undefined)
const errText = (section) => (section?.error ? ` (${section.error})` : '')

export function buildAlerts(data, now) {
  const alerts = []
  const missing = (label, section) => alerts.push(`No se pudo verificar: ${label}${errText(section) || ' (sin datos)'}.`)

  // PAID order without ISSUED/REISSUED ticket or without SENT email.
  const integrity = val(data.integrity)
  if (!integrity) missing('órdenes PAID sin boleto/correo', data.integrity)
  else {
    if (num(integrity.no_ticket) > 0)
      alerts.push(`${num(integrity.no_ticket)} orden(es) PAID sin boleto ISSUED/REISSUED (ids: ${integrity.no_ticket_ids || '-'}).`)
    if (num(integrity.no_mail) > 0)
      alerts.push(`${num(integrity.no_mail)} orden(es) PAID con boleto pero sin correo SENT (ids: ${integrity.no_mail_ids || '-'}).`)
  }

  // Webhook v1.0 rejected or failed (DB rows not accepted + gateway rejections).
  const webhooks = val(data.webhooks)
  if (!webhooks) missing('webhooks 24 h', data.webhooks)
  else {
    const v1 = webhooks.byType['v1.0']
    const gateway = val(data.gatewayWebhook)
    const gatewayRejected = gateway ? gateway.rejected['v1.0'] : 0
    const total = num(v1?.failed) + gatewayRejected
    if (total > 0)
      alerts.push(`Webhook v1.0 rechazado o fallido en 24 h: ${num(v1?.failed)} en BD + ${gatewayRejected} rechazo(s) en gateway.`)
  }

  // 5xx on the payment path.
  const health = val(data.functionLogs)
  if (!health) missing('errores 5xx de funciones', data.functionLogs)
  else {
    for (const slug of WATCHED_5XX) {
      const c5xx = health.perFn[slug]?.c5xx ?? 0
      if (c5xx > 0) alerts.push(`${c5xx} error(es) 5xx en ${slug} (24 h).`)
    }
  }

  // Live function differs from origin/main bundle.
  const drift = val(data.drift)
  if (!drift) missing('drift de funciones vs origin/main', data.drift)
  else {
    for (const row of drift.rows.filter((r) => r.status === 'DRIFT'))
      alerts.push(`Drift: ${row.slug} viva (${row.liveSha}) ≠ bundle de origin/main (${row.bundleSha}).`)
    for (const row of drift.rows.filter((r) => r.status === 'ERROR'))
      alerts.push(`No se pudo comparar ${row.slug} con origin/main.`)
  }

  // Price stage coherent with the calendar.
  const stages = val(data.stageOrders)
  if (!stages) missing('etapa de precio vs fecha', data.stageOrders)
  else {
    const bad = stages.filter((o) => o.st && o.st !== expectedStage(new Date(o.created_at)))
    if (bad.length > 0)
      alerts.push(
        `Etapa de precio ≠ fecha en ${bad.length} orden(es) de 24 h (esperada hoy: ${STAGE_LABEL[expectedStage(now)]}; vistas: ${[...new Set(bad.map((o) => o.st))].join(', ')}).`,
      )
  }

  // No sale in 48 h.
  const paid = val(data.paidTotals)
  if (!paid) missing('ventas últimas 48 h', data.paidTotals)
  else if (num(paid.n48) === 0)
    alerts.push(
      `Ninguna venta en 48 h (última venta: ${paid.last_paid_at ? fmtMerida(new Date(paid.last_paid_at)) : 'nunca'}).`,
    )

  return alerts
}

// ---------------------------------------------------------------- rendering

function sectionSales(data) {
  const orders = val(data.orders)
  const byProduct = val(data.paidByProduct)
  const paid = val(data.paidTotals)
  const legacy = val(data.legacy)
  const out = ['## 1. Ventas']

  out.push('', '**Órdenes por estado**', '')
  if (!orders) out.push(warn(data.orders?.error ?? 'sin datos'))
  else {
    const rows = orders.map((o) => [o.state, num(o.n24), num(o.n_all)])
    rows.push(['**Total**', orders.reduce((s, o) => s + num(o.n24), 0), orders.reduce((s, o) => s + num(o.n_all), 0)])
    out.push(table(['Estado', 'Creadas 24 h', 'Acumulado'], rows))
  }

  out.push('', '**PAID por producto**', '')
  if (!byProduct) out.push(warn(data.paidByProduct?.error ?? 'sin datos'))
  else if (byProduct.length === 0) out.push('Sin órdenes PAID.')
  else {
    const rows = byProduct.map((p) => [p.product_code, num(p.q24), money(p.c24), num(p.q_all), money(p.c_all)])
    rows.push([
      '**Total**',
      byProduct.reduce((s, p) => s + num(p.q24), 0),
      money(byProduct.reduce((s, p) => s + num(p.c24), 0)),
      byProduct.reduce((s, p) => s + num(p.q_all), 0),
      money(byProduct.reduce((s, p) => s + num(p.c_all), 0)),
    ])
    out.push(table(['Producto', 'Uds 24 h', 'Monto 24 h', 'Uds acum.', 'Monto acum.'], rows))
  }

  out.push('', '**Total pagado**', '')
  if (!paid || !legacy) out.push(warn(data.paidTotals?.error ?? data.legacy?.error ?? 'sin datos'))
  else {
    const paidLegacy = legacy.filter((l) => l.commercial_status === 'LEGACY_PAID' && !l.courtesy)
    const courtesy = legacy.filter((l) => l.commercial_status === 'LEGACY_PAID' && l.courtesy)
    const legacyN = paidLegacy.reduce((s, l) => s + num(l.n), 0)
    const legacyCents = paidLegacy.reduce((s, l) => s + num(l.cents), 0)
    const courtesyN = courtesy.reduce((s, l) => s + num(l.n), 0)
    out.push(
      table(
        ['Fuente', 'Órdenes / registros', 'Monto'],
        [
          ['ready2hybrid (PAID)', num(paid.n_all), money(paid.cents_all)],
          ['legacy (LEGACY_PAID, sin cortesías)', legacyN, money(legacyCents)],
          ['**Total pagado**', num(paid.n_all) + legacyN, `**${money(num(paid.cents_all) + legacyCents)}**`],
        ],
      ),
      '',
      `Cortesías legacy (aparte, no suman): ${courtesyN}. Reembolsadas ready2hybrid (no suman): ${
        orders ? num(orders.find((o) => o.state === 'REFUNDED')?.n_all) : 'n/d'
      }.`,
    )
  }
  return out
}

function sectionFunnel(data) {
  const f = val(data.funnel)
  const out = ['## 2. Embudo (24 h)', '']
  if (!f) return [...out, warn(data.funnel?.error ?? 'sin datos')]
  const created = num(f.created)
  const pct = (n) => (created > 0 ? ` (${Math.round((num(n) / created) * 100)}%)` : '')
  out.push(
    table(
      ['Etapa', 'Checkouts'],
      [
        ['Creados', created],
        ['Pagados', `${num(f.paid)}${pct(f.paid)}`],
        ['Vencidos (pendientes con vigencia agotada)', `${num(f.expired)}${pct(f.expired)}`],
        ['Aún vigentes', `${num(f.open)}${pct(f.open)}`],
        ['Otros (rechazados / revisión / reembolsados)', `${num(f.other)}${pct(f.other)}`],
      ],
    ),
    '',
    `Personas únicas que abandonaron (vencidas y sin ninguna compra pagada): **${num(f.abandoned)}**`,
  )
  return out
}

function sectionPayments(data) {
  const wh = val(data.webhooks)
  const gw = val(data.gatewayWebhook)
  const rv = val(data.reversals)
  const out = ['## 3. Pagos y webhooks (24 h)', '']
  if (!wh) out.push(warn(data.webhooks?.error ?? 'sin datos'))
  else {
    const types = ['v1.0', 'Feed v2.0', 'otro']
    const rows = types.map((t) => {
      const r = wh.byType[t] ?? { received: 0, accepted: 0, failed: 0 }
      return [t, num(r.received), num(r.accepted), num(r.failed), gw ? gw.rejected[t] : 'n/d']
    })
    out.push(table(['Tipo', 'Recibidos (BD)', 'Aceptados', 'Fallidos (BD)', 'Rechazados en gateway'], rows))
    out.push(
      '',
      `Los rechazos por firma no se guardan en BD; se leen del log del gateway${
        gw ? ` (ventana disponible: ${gw.windowHours.toFixed(1)} h de 24 h).` : ' (no disponible).'
      }`,
    )
    const fn = val(data.functionLogs)
    const hook = fn?.perFn['mp-webhook']
    const total = (hook?.c4xx ?? 0) + (hook?.c5xx ?? 0)
    if (total > 0) {
      const typed = gw ? gw.rejected['v1.0'] + gw.rejected['Feed v2.0'] + gw.rejected.otro : 0
      out.push(
        '',
        `mp-webhook devolvió ${total} rechazo(s)/error(es) en el log de funciones (ventana ${fn.windowHours.toFixed(1)} h): ${Math.min(total, typed)} con tipo identificado, ${Math.max(0, total - typed)} sin tipo (ese log no trae user-agent).`,
      )
    }
  }
  out.push('')
  if (!rv) out.push(warn(data.reversals?.error ?? 'sin datos'))
  else
    out.push(
      table(
        ['Reversa', '24 h', 'Monto 24 h', 'Acumulado', 'Monto acum.'],
        [
          ['Reembolsos', num(rv.refunds24), money(rv.refunds24_cents), num(rv.refunds_all), money(rv.refunds_all_cents)],
          ['Contracargos', num(rv.cb24), money(rv.cb24_cents), num(rv.cb_all), money(rv.cb_all_cents)],
          ['Boletos revocados', num(rv.revoked24), '-', num(rv.revoked_all), '-'],
        ],
      ),
    )
  return out
}

function sectionEmail(data) {
  const rows = val(data.outbox)
  const out = ['## 4. Correos de boletos', '']
  if (!rows) return [...out, warn(data.outbox?.error ?? 'sin datos')]
  const ticket = rows.filter((r) => r.communication_type === 'TICKET_READY')
  const pick = (pred, key) => ticket.filter(pred).reduce((s, r) => s + num(r[key]), 0)
  const sent = (r) => r.state === 'SENT'
  const pending = (r) => r.state === 'PENDING' || r.state === 'QUEUED'
  const failed = (r) => !sent(r) && !pending(r)
  out.push(
    table(
      ['Estado', '24 h', 'Acumulado'],
      [
        ['Enviados (SENT)', pick(sent, 'n24'), pick(sent, 'n_all')],
        ['Fallidos', pick(failed, 'n24'), pick(failed, 'n_all')],
        ['Pendientes', pick(pending, 'n24'), pick(pending, 'n_all')],
      ],
    ),
  )
  const internal = rows.filter((r) => r.communication_type === 'INTERNAL_ALERT' && r.state === 'PENDING')
  if (internal.length > 0)
    out.push(
      '',
      `Alertas internas pendientes de atender: ${internal.reduce((s, r) => s + num(r.n_all), 0)} (nuevas en 24 h: ${internal.reduce((s, r) => s + num(r.n24), 0)}).`,
    )
  return out
}

function sectionFunctions(data) {
  const health = val(data.functionLogs)
  const drift = val(data.drift)
  const out = ['## 5. Salud de funciones (24 h)', '']
  if (!health) out.push(warn(data.functionLogs?.error ?? 'sin datos'))
  else {
    const slugs = [...new Set([...(drift?.rows.map((r) => r.slug) ?? []), ...Object.keys(health.perFn)])].sort()
    const rows = slugs.map((slug) => {
      const h = health.perFn[slug] ?? { calls: 0, c4xx: 0, c5xx: 0 }
      const d = drift?.rows.find((r) => r.slug === slug)
      const sha = d
        ? d.status === 'IDENTICAL'
          ? `✅ ${d.liveSha}`
          : d.status === 'DRIFT'
            ? `❌ vivo ${d.liveSha} ≠ bundle ${d.bundleSha}`
            : d.status === 'NO_BUNDLE'
              ? `${d.liveSha} (sin bundle en origin/main)`
              : 'n/d'
        : 'n/d'
      return [slug, h.calls, h.c4xx, h.c5xx, sha]
    })
    out.push(table(['Función', 'Llamadas', '4xx', '5xx', 'SHA vivo vs bundle origin/main'], rows))
    out.push(
      '',
      health.windowHours < 23.5
        ? `⚠️ Ventana parcial: el CLI de InsForge solo entrega las últimas ${health.entries} líneas de log, que cubren ${health.windowHours.toFixed(1)} h de las 24 h. Conteos = mínimos.`
        : 'Ventana de logs: 24 h completas.',
    )
  }
  if (!drift) out.push('', warn(data.drift?.error ?? 'sin datos de SHA'))
  return out
}

function sectionRepos(data) {
  const repo = val(data.repo)
  const out = ['## 6. Repos', '']
  if (!repo) return [...out, warn(data.repo?.error ?? 'sin datos')]
  out.push(`- **origin/main**: \`${repo.mainSha}\` — ${repo.mainSubject} (${repo.mainDate})`)
  const drift = val(data.drift)
  if (drift) {
    const count = (s) => drift.rows.filter((r) => r.status === s).length
    out.push(
      `- **Desplegado vs origin/main**: ${count('IDENTICAL')} idénticas, ${count('DRIFT')} con drift, ${count('NO_BUNDLE')} sin bundle en main.`,
    )
  }
  out.push(`- **PRs abiertos ready2hybrid**: ${repo.prs.length === 0 ? 'ninguno' : ''}`)
  for (const pr of repo.prs) out.push(`  - #${pr.number} ${pr.title} (\`${pr.headRefName}\`)`)
  out.push(`- **PRs abiertos landing**: ${repo.landingPrs === null ? 'n/d' : repo.landingPrs.length === 0 ? 'ninguno' : ''}`)
  for (const pr of repo.landingPrs ?? []) out.push(`  - #${pr.number} ${pr.title} (\`${pr.headRefName}\`)`)
  if (repo.unmergedDeployed.length === 0) out.push('- **Ramas desplegadas sin merge**: ninguna detectada')
  else {
    out.push('- **Ramas desplegadas sin merge**:')
    for (const d of repo.unmergedDeployed) out.push(`  - \`${d.slug}\` ← \`${d.ref}\``)
  }
  out.push(`- Ramas con commits aún no integrados a origin/main: ${repo.unmergedRefs}`)
  return out
}

function sectionTreasury(data) {
  const rows = val(data.treasury)
  const out = ['## 7. Tesorería — próximos 7 días (scheduled)', '']
  if (!rows) return [...out, warn(data.treasury?.error ?? 'sin datos')]
  if (rows.length === 0) return [...out, 'Sin movimientos programados.']
  out.push(
    table(
      ['Fecha', 'Tipo', 'Cuenta', 'Monto'],
      rows.map((r) => [
        `${String(r.occurred_on).slice(0, 10)}${r.overdue ? ' ⚠️ vencido' : ''}`,
        r.type,
        r.dest ? `${r.account} → ${r.dest}` : r.account,
        money(r.amount_cents),
      ]),
    ),
  )
  return out
}

function sectionCalendar(now) {
  const rows = [
    ['Fin de Preventa (26-oct 23:59)', countdown(now, merida(2026, 10, 26, 23, 59))],
    ['Cierre de venta (13-nov 11:00)', countdown(now, CALENDAR.salesClose)],
    ['Entrega de kits (12-nov 17:00)', countdown(now, CALENDAR.kitDelivery)],
    ['Evento (13-nov 2026)', countdown(now, CALENDAR.eventStart)],
  ]
  return ['## 8. Calendario', '', table(['Hito', 'Falta'], rows)]
}

export function renderReport(data, now) {
  const alerts = buildAlerts(data, now)
  const out = [
    '# ☀️ Buenos días del sistema — HEX-2026',
    '',
    `Generado: ${fmtMerida(now)} (America/Mérida) · Etapa vigente por fecha: **${STAGE_LABEL[expectedStage(now)]}** · ${alerts.length === 0 ? '✅ sin alertas' : `🚨 ${alerts.length} alerta(s)`}`,
  ]
  if (alerts.length > 0) out.push('', '## 🚨 ALERTAS', '', ...alerts.map((a) => `- ${a}`))
  for (const section of [
    sectionSales(data),
    sectionFunnel(data),
    sectionPayments(data),
    sectionEmail(data),
    sectionFunctions(data),
    sectionRepos(data),
    sectionTreasury(data),
    sectionCalendar(now),
  ])
    out.push('', ...section)
  out.push('', '---', 'Solo lectura: sin cambios en datos, despliegues ni reenvíos. Solo conteos y montos.', '')
  return out.join('\n')
}

// ---------------------------------------------------------------- data collection (impure)

const workDir = () => process.env.INSFORGE_CWD ?? process.env.INIT_CWD ?? process.cwd()

function run(cmd, timeout = 180_000) {
  return new Promise((resolveRun, reject) => {
    exec(cmd, { cwd: workDir(), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd.split(' ').slice(0, 5).join(' ')} → ${String(stderr || err.message).split('\n').find((l) => l.trim() && !/npm warn/i.test(l)) ?? 'failed'}`.slice(0, 200)))
      else resolveRun(stdout)
    })
  })
}

const cli = (args) => run(['npx', '-y', '@insforge/cli', ...args].join(' '))

const SELECT_ONLY = /^\s*(select|with)\b/i
const FORBIDDEN = /;|"|%|\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b/i

/** Read-only SQL through the CLI. Single line; no quotes/semicolons so cmd.exe cannot reinterpret it. */
export async function sql(statement) {
  const flat = statement.replace(/\s+/g, ' ').trim()
  if (!SELECT_ONLY.test(flat) || FORBIDDEN.test(flat)) throw new Error('sql rejected by read-only guard')
  const out = await cli(['db', 'query', `"${flat}"`, '--json'])
  const parsed = JSON.parse(out.slice(out.indexOf('{')))
  return parsed.rows ?? []
}

const safe = async (fn) => {
  try {
    return { value: await fn() }
  } catch (error) {
    return { error: String(error?.message ?? error).slice(0, 200) }
  }
}

function pool(limit) {
  let active = 0
  const queue = []
  const next = () => {
    if (active >= limit || queue.length === 0) return
    active += 1
    const { fn, resolveTask, rejectTask } = queue.shift()
    fn().then(resolveTask, rejectTask).finally(() => {
      active -= 1
      next()
    })
  }
  return (fn) => new Promise((resolveTask, rejectTask) => { queue.push({ fn, resolveTask, rejectTask }); next() })
}

const H24 = "now() - interval '24 hours'"
const PAID_CTE = `with paid as (select o.id, o.total_cents, coalesce((select min(p.created_at) from payments p where p.order_id = o.id and p.normalized_state = 'APPROVED'), o.updated_at) paid_at from orders o where o.state = 'PAID')`

const QUERIES = {
  orders: `select state, count(*) filter (where created_at >= ${H24}) n24, count(*) n_all, coalesce(sum(total_cents), 0) cents_all from orders group by state order by state`,
  paidByProduct: `${PAID_CTE} select oi.product_code, sum(oi.quantity) q_all, sum(oi.item_total_cents) c_all, coalesce(sum(oi.quantity) filter (where paid.paid_at >= ${H24}), 0) q24, coalesce(sum(oi.item_total_cents) filter (where paid.paid_at >= ${H24}), 0) c24 from order_items oi join paid on paid.id = oi.order_id group by oi.product_code order by c_all desc`,
  paidTotals: `${PAID_CTE} select count(*) n_all, coalesce(sum(total_cents), 0) cents_all, count(*) filter (where paid_at >= ${H24}) n24, coalesce(sum(total_cents) filter (where paid_at >= ${H24}), 0) cents24, count(*) filter (where paid_at >= now() - interval '48 hours') n48, max(paid_at) last_paid_at from paid`,
  legacy: `select commercial_status, coalesce(courtesy, false) courtesy, count(*) n, coalesce(sum(amount_cents), 0) cents from legacy_registrations where missing_since is null group by 1, 2`,
  funnel: `select count(*) created, count(*) filter (where state = 'PAID') paid, count(*) filter (where state = 'PAYMENT_PENDING' and expires_at < now()) expired, count(*) filter (where state = 'PAYMENT_PENDING' and expires_at >= now()) open, count(*) filter (where state not in ('PAID', 'PAYMENT_PENDING')) other, (select count(distinct o2.buyer_contact_id) from orders o2 where o2.created_at >= ${H24} and o2.state = 'PAYMENT_PENDING' and o2.expires_at < now() and not exists (select 1 from orders o3 where o3.buyer_contact_id = o2.buyer_contact_id and o3.state = 'PAID')) abandoned from orders where created_at >= ${H24}`,
  webhooks: `select coalesce(sanitized_headers->>'user-agent', '') ua, signature_result sig, processing_state ps, count(*) n from webhook_events where received_at >= ${H24} group by 1, 2, 3`,
  reversals: `select (select count(*) from payments where normalized_state = 'REFUNDED' and updated_at >= ${H24}) refunds24, (select coalesce(sum(amount_cents), 0) from payments where normalized_state = 'REFUNDED' and updated_at >= ${H24}) refunds24_cents, (select count(*) from payments where normalized_state = 'REFUNDED') refunds_all, (select coalesce(sum(amount_cents), 0) from payments where normalized_state = 'REFUNDED') refunds_all_cents, (select count(*) from payments where normalized_state = 'CHARGED_BACK' and updated_at >= ${H24}) cb24, (select coalesce(sum(amount_cents), 0) from payments where normalized_state = 'CHARGED_BACK' and updated_at >= ${H24}) cb24_cents, (select count(*) from payments where normalized_state = 'CHARGED_BACK') cb_all, (select coalesce(sum(amount_cents), 0) from payments where normalized_state = 'CHARGED_BACK') cb_all_cents, (select count(*) from tickets where state = 'REVOKED' and revoked_at >= ${H24}) revoked24, (select count(*) from tickets where state = 'REVOKED') revoked_all`,
  integrity: `select count(*) filter (where not has_ticket) no_ticket, count(*) filter (where has_ticket and not has_mail) no_mail, array_to_string((array_agg(left(id::text, 8)) filter (where not has_ticket))[1:5], ',') no_ticket_ids, array_to_string((array_agg(left(id::text, 8)) filter (where has_ticket and not has_mail))[1:5], ',') no_mail_ids from (select o.id, exists (select 1 from registrations r join tickets t on t.registration_id = r.id where r.order_id = o.id and t.state in ('ISSUED', 'REISSUED')) has_ticket, exists (select 1 from registrations r join tickets t on t.registration_id = r.id join outbox_delivery_jobs j on j.domain_event_ref = 'ticket:' || t.id::text where r.order_id = o.id and j.communication_type = 'TICKET_READY' and j.state = 'SENT') has_mail from orders o where o.state = 'PAID') x`,
  outbox: `select communication_type, state, count(*) filter (where updated_at >= ${H24}) n24, count(*) n_all from outbox_delivery_jobs group by 1, 2`,
  stageOrders: `select commercial_snapshot->>'commercial_stage' st, created_at from orders where created_at >= ${H24}`,
  treasury: `select m.occurred_on, m.type, m.amount_cents, a.name account, d.name dest, (m.occurred_on < (now() at time zone 'America/Merida')::date) overdue from treasury_movements m join treasury_accounts a on a.id = m.account_id left join treasury_accounts d on d.id = m.destination_account_id where m.status = 'scheduled' and m.occurred_on <= (now() at time zone 'America/Merida')::date + 7 order by m.occurred_on, m.created_at`,
}

function shapeWebhooks(rows) {
  const byType = {}
  for (const r of rows) {
    const type = classifyWebhookType(r.ua)
    const slot = (byType[type] ??= { received: 0, accepted: 0, failed: 0 })
    const n = num(r.n)
    slot.received += n
    if (r.sig === 'VALID' && (r.ps === 'PROCESSED' || r.ps === 'IGNORED')) slot.accepted += n
    else slot.failed += n
  }
  return { byType }
}

async function readLogs(source) {
  const out = await cli(['logs', source, '--limit', '1000', '--json'])
  const parsed = JSON.parse(out.slice(out.indexOf('{')))
  return parsed.logs ?? []
}

const normalizeCode = (text) => text.replace(/\r\n/g, '\n').trim()
const sha12 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12)

function git(args) {
  const r = spawnSync('git', args, { cwd: workDir(), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`git ${args[0]} failed`)
  return r.stdout
}

const gitOrNull = (args) => {
  try {
    return git(args)
  } catch {
    return null
  }
}

async function collectDrift(limit) {
  try {
    git(['fetch', 'origin', '--prune', '--quiet'])
  } catch {
    // Offline: compare against whatever origin/main was last fetched; the repo section shows its SHA.
  }
  const listed = JSON.parse((await cli(['functions', 'list', '--json'])).replace(/^[^{[]*/, ''))
  const live = (listed.functions ?? listed).filter((f) => f.status === 'active').map((f) => f.slug)
  const tracked = new Set(
    git(['ls-tree', '-r', '--name-only', 'origin/main', 'insforge/functions'])
      .split('\n')
      .filter((p) => p.endsWith('/handler.deploy.js'))
      .map((p) => p.split('/')[2]),
  )
  const unmergedRefs = git(['for-each-ref', '--no-merged=origin/main', '--format=%(refname:short)', 'refs/remotes/origin', 'refs/heads'])
    .split('\n')
    .filter((r) => r && r !== 'origin/HEAD')

  const rows = await Promise.all(
    live.map((slug) =>
      limit(async () => {
        try {
          const out = await cli(['functions', 'code', slug])
          const header = out.indexOf('\n---')
          if (header < 0) throw new Error('unexpected CLI output')
          const liveCode = normalizeCode(out.slice(header + 4))
          const liveSha = sha12(liveCode)
          const path = `insforge/functions/${slug}/handler.deploy.js`
          const bundle = tracked.has(slug) ? gitOrNull(['show', `origin/main:${path}`]) : null
          const row = { slug, liveSha, bundleSha: bundle === null ? '-' : sha12(normalizeCode(bundle)) }
          row.status = bundle === null ? 'NO_BUNDLE' : row.liveSha === row.bundleSha ? 'IDENTICAL' : 'DRIFT'
          if (row.status !== 'IDENTICAL') {
            row.ref = unmergedRefs.find((ref) => {
              const candidate = gitOrNull(['show', `${ref}:${path}`])
              return candidate !== null && sha12(normalizeCode(candidate)) === liveSha
            })
          }
          return row
        } catch {
          return { slug, status: 'ERROR', liveSha: '-', bundleSha: '-' }
        }
      }),
    ),
  )
  return { rows: rows.sort((a, b) => a.slug.localeCompare(b.slug)), unmergedRefs: unmergedRefs.length }
}

async function collectRepo(drift) {
  const mainSha = git(['rev-parse', '--short=8', 'origin/main']).trim()
  const [mainDate, mainSubject] = git(['log', '-1', '--format=%cI%n%s', 'origin/main']).trim().split('\n')
  const prList = async (extra) => {
    try {
      return JSON.parse(await run(['gh', 'pr', 'list', '--state', 'open', '--limit', '30', '--json', 'number,title,headRefName', ...extra].join(' ')))
    } catch {
      return null
    }
  }
  return {
    mainSha,
    mainSubject,
    mainDate: fmtMerida(new Date(mainDate)),
    prs: (await prList([])) ?? [],
    landingPrs: await prList(['--repo', LANDING_REPO]),
    unmergedDeployed: (drift?.rows ?? []).filter((r) => r.ref).map((r) => ({ slug: r.slug, ref: r.ref })),
    unmergedRefs: drift?.unmergedRefs ?? 0,
  }
}

export async function collect() {
  const limit = pool(6)
  const q = (name) => safe(() => limit(() => sql(QUERIES[name])))
  const [orders, paidByProduct, paidTotals, legacy, funnel, webhookRows, reversals, integrity, outbox, stageOrders, treasury, fnLogs, gwLogs, drift] =
    await Promise.all([
      q('orders'), q('paidByProduct'), q('paidTotals'), q('legacy'), q('funnel'), q('webhooks'), q('reversals'),
      q('integrity'), q('outbox'), q('stageOrders'), q('treasury'),
      safe(() => limit(() => readLogs('function.logs'))),
      safe(() => limit(() => readLogs('insforge.logs'))),
      safe(() => collectDrift(limit)),
    ])
  const now = new Date()
  const first = (s) => (s.error ? s : { value: s.value[0] ?? {} })
  const repo = await safe(() => collectRepo(drift.value))
  return {
    now,
    orders,
    paidByProduct,
    paidTotals: first(paidTotals),
    legacy: legacy.error ? legacy : { value: legacy.value.map((r) => ({ ...r, courtesy: r.courtesy === true || r.courtesy === 'true' })) },
    funnel: first(funnel),
    webhooks: webhookRows.error ? webhookRows : { value: shapeWebhooks(webhookRows.value) },
    reversals: first(reversals),
    integrity: first(integrity),
    outbox,
    stageOrders,
    treasury,
    functionLogs: fnLogs.error ? fnLogs : { value: summarizeFunctionLogs(fnLogs.value, now) },
    gatewayWebhook: gwLogs.error ? gwLogs : { value: summarizeGatewayWebhook(gwLogs.value, now) },
    drift,
    repo,
  }
}

async function main() {
  const data = await collect()
  const markdown = renderReport(data, data.now)
  const dir = join(homedir(), 'Documents', 'hybrid-reportes')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${dateKey(data.now)}.md`)
  writeFileSync(file, markdown, 'utf8')
  console.log(markdown)
  console.error(`Reporte guardado en ${file}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`morning-report failed: ${error?.message ?? error}`)
    process.exit(1)
  })
}
