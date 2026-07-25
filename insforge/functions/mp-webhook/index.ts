import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { createHttpPaymentClient } from '../_shared/mercadopago/payments'
import { WebhookError } from '../_shared/webhook/errors'
import { orchestrateWebhook, type WebhookRepository } from '../_shared/webhook/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createLazyRepo(): WebhookRepository {
  let inner: WebhookRepository | null = null

  function getInner(): WebhookRepository {
    if (inner) return inner
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new WebhookError('CONFIGURATION_ERROR')
    }
    const admin = createAdminClient({ baseUrl, apiKey })
    inner = {
      async applyPaymentTx(input) {
        const { data, error } = await admin.database.rpc('webhook_apply_payment_tx', {
          p: {
            provider_notification_id: input.providerNotificationId,
            notification_type: input.notificationType,
            canonical_input_hash: input.canonicalInputHash,
            sanitized_headers: input.sanitizedHeaders,
            provider_payment_id: input.providerPaymentId,
            external_state: input.externalState,
            normalized_state: input.normalizedState,
            amount_cents: input.amountCents,
            currency: input.currency,
            external_reference: input.externalReference,
            merchant_ownership_ok: input.merchantOwnershipOk,
            external_reference_ok: input.externalReferenceOk,
            amount_ok: input.amountOk,
            currency_ok: input.currencyOk,
            provider_created_at: input.providerCreatedAt,
            provider_updated_at: input.providerUpdatedAt,
            correlation_id: input.correlationId,
            live_mode: input.liveMode,
            collector_id: input.collectorId,
          },
        })
        if (error) {
          throw new WebhookError('INTERNAL_ERROR')
        }
        const row = data as { ok?: boolean; replay?: boolean; outcome?: string; error_code?: string }
        return {
          ok: Boolean(row?.ok),
          replay: Boolean(row?.replay),
          outcome: row?.outcome,
          error_code: row?.error_code,
        }
      },
    }
    return inner
  }

  return {
    applyPaymentTx: (input) => getInner().applyPaymentTx(input),
  }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const result = await orchestrateWebhook(req, {
      env,
      payments: createHttpPaymentClient(),
      repo: createLazyRepo(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof WebhookError) {
      if (error.code === 'UNSUPPORTED_TOPIC') {
        return jsonResponse(200, { ok: true, ignored: true })
      }
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new WebhookError('INTERNAL_ERROR').toPublicBody())
  }
}
