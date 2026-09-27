import type { InsForgeClient } from '@insforge/sdk'

/**
 * Stable project function route: `{VITE_INSFORGE_URL}/functions/{slug}`.
 * SDK 1.5.1 `functions.invoke` first calls `{app}.functions.insforge.app`.
 * That host is the retired Deno runtime. A browser cannot read its 404, so
 * the SDK never reaches this route. Do not point the client at function2.
 */
export function projectFunctionPath(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Invalid function slug')
  }
  return `/functions/${slug}`
}

export async function postProjectFunction<T>(
  client: InsForgeClient,
  slug: string,
  body: unknown,
): Promise<T> {
  return client.getHttpClient().post<T>(projectFunctionPath(slug), body)
}
