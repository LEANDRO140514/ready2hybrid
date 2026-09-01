import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { SendTicketEmailError } from '../_shared/email/errors'
import { orchestrateSendTicketEmail } from '../_shared/email/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function createLazyAdminClient() {
  let client: ReturnType<typeof createAdminClient> | null = null

  return function getAdminClient() {
    if (client) return client
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new SendTicketEmailError('CONFIGURATION_ERROR')
    }
    client = createAdminClient({ baseUrl, apiKey })
    return client
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const result = await orchestrateSendTicketEmail(req, {
      env,
      getAdminClient: createLazyAdminClient(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof SendTicketEmailError) {
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new SendTicketEmailError('INTERNAL_ERROR').toPublicBody())
  }
}
