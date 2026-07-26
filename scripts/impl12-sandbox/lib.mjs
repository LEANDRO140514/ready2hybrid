import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const BRANCH_BASE = 'https://4bg9ufz2-jyq.us-east.insforge.app'

export function loadEnvFile(filePath) {
  const out = Object.create(null)
  if (!fs.existsSync(filePath)) return out
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1].replace(/-/g, '_')
    out[key] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

export function hmacSha256Hex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex')
}

export function buildSignedWebhookHeaders({ secret, dataId, requestId, ts = String(Math.floor(Date.now() / 1000)) }) {
  const dataIdNormalized = String(dataId).trim().toLowerCase()
  const rid = requestId || crypto.randomUUID()
  const manifest = `id:${dataIdNormalized};request-id:${rid};ts:${ts};`
  const v1 = hmacSha256Hex(secret, manifest)
  return {
    'content-type': 'application/json',
    'x-request-id': rid,
    'x-signature': `ts=${ts},v1=${v1}`,
    dataIdNormalized,
    rid,
    ts,
  }
}

export async function postWebhook({ secret, dataId, body }) {
  const headers = buildSignedWebhookHeaders({ secret, dataId })
  const url = `${BRANCH_BASE}/functions/mp-webhook?data.id=${encodeURIComponent(headers.dataIdNormalized)}&type=payment`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': headers['content-type'],
      'x-request-id': headers['x-request-id'],
      'x-signature': headers['x-signature'],
    },
    body: JSON.stringify(
      body || {
        action: 'payment.updated',
        type: 'payment',
        data: { id: headers.dataIdNormalized },
      },
    ),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return {
    status: res.status,
    body: json,
    raw: text.slice(0, 500),
    requestId: headers.rid,
  }
}

export async function postCheckout(payload) {
  const res = await fetch(`${BRANCH_BASE}/functions/mp-create-checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, body: json, raw: text.slice(0, 800) }
}

export function workspaceEnvPath() {
  return path.resolve('C:/vonde/enforma-sys/ready2hybrid/.cursor/mcp.env')
}
