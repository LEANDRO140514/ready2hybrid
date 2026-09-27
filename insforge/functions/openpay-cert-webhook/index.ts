import { handleCertWebhook, type CertEnv } from '../_shared/openpay-cert/harness.ts'

function certEnv(): CertEnv {
  return {
    enabled: Deno.env.get('OPENPAY_ENABLED'),
    sandbox: Deno.env.get('OPENPAY_SANDBOX'),
    merchantId: Deno.env.get('OPENPAY_MERCHANT_ID'),
    privateKey: Deno.env.get('OPENPAY_PRIVATE_KEY'),
    publicKey: Deno.env.get('OPENPAY_PUBLIC_KEY'),
    webhookUser: Deno.env.get('OPENPAY_WEBHOOK_USER'),
    webhookPassword: Deno.env.get('OPENPAY_WEBHOOK_PASSWORD'),
    redirectUrl: Deno.env.get('OPENPAY_REDIRECT_URL'),
  }
}

export default function handler(request: Request): Promise<Response> {
  return handleCertWebhook(request, certEnv(), fetch)
}
