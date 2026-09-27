/**
 * HEX-2026 current edition ticket photographs.
 *
 * The product → relative path relationship is the landing PRODUCT_IMAGES map.
 * Ticket rendering resolves those paths on Ready2Hybrid Storage so a boleto
 * does not fetch the enforma project at runtime.
 *
 * This edition sells 17 ticketable products, which share 9 photographs.
 * Workout and Photographer stay in the product model for a future edition
 * and are not part of this edition's active image coverage.
 */
export const TICKET_CARD_ASSET_BASE =
  'https://4bg9ufz2.us-east.insforge.app/api/storage/buckets/images/objects/'

const INDIVIDUAL_HOMBRE = 'individual/individual-hombre-corriendo-pista-w800.webp'
const INDIVIDUAL_MUJER = 'individual/individual-mujer-corriendo-pista-w800.webp'
const DOBLES_MUJERES = 'doubles/dobles-mujeres-remo-equipo-w800.webp'
const DOBLES_HOMBRES = 'doubles/dobles-hombres-remo-asistido-w800.webp'
const DOBLES_MIXTO = 'doubles/dobles-mixto-remo-equipo-w800.webp'
const RELAY_HOMBRES = 'relay/relay-equipo-hombres-legends-w800.webp'
const RELAY_MUJERES = 'relay/relay-equipo-mujeres-team712-w800.webp'
const RELAY_MIXTO = 'relay/relay-equipo-mixto-cambio-w800.webp'
const PUBLICO = 'atmosphere/publico-animando-graderio-w800.webp'
const SKIERG_FALLBACK = 'stations/estacion-skierg-concept2-w800.webp'

export const CURRENT_EDITION_TICKETABLE_PRODUCTS = [
  'IND-H',
  'IND-M',
  'DOB-VIE-MM',
  'DOB-SAB-HH',
  'DOB-SAB-MH',
  'REL-4H',
  'REL-4M',
  'REL-2H2M',
  'HALF-IND-H',
  'HALF-IND-M',
  'HALF-DOB-MM',
  'HALF-DOB-HH',
  'HALF-DOB-MH',
  'PUB-VIE',
  'PUB-SAB',
  'PUB-DOM',
  'PUB-3D',
] as const

export const PRODUCT_CARD_PATHS: Record<(typeof CURRENT_EDITION_TICKETABLE_PRODUCTS)[number], string> = {
  'IND-H': INDIVIDUAL_HOMBRE,
  'HALF-IND-H': INDIVIDUAL_HOMBRE,
  'IND-M': INDIVIDUAL_MUJER,
  'HALF-IND-M': INDIVIDUAL_MUJER,
  'DOB-VIE-MM': DOBLES_MUJERES,
  'HALF-DOB-MM': DOBLES_MUJERES,
  'DOB-SAB-HH': DOBLES_HOMBRES,
  'HALF-DOB-HH': DOBLES_HOMBRES,
  'DOB-SAB-MH': DOBLES_MIXTO,
  'HALF-DOB-MH': DOBLES_MIXTO,
  'REL-4H': RELAY_HOMBRES,
  'REL-4M': RELAY_MUJERES,
  'REL-2H2M': RELAY_MIXTO,
  'PUB-VIE': PUBLICO,
  'PUB-SAB': PUBLICO,
  'PUB-DOM': PUBLICO,
  'PUB-3D': PUBLICO,
}

export function cardAssetUrl(relativePath: string): string {
  return `${TICKET_CARD_ASSET_BASE}${encodeURIComponent(relativePath)}`
}

export const FALLBACK_CARD_IMAGE = cardAssetUrl(SKIERG_FALLBACK)

export const PRODUCT_CARD_IMAGES: Record<string, string> = Object.fromEntries(
  CURRENT_EDITION_TICKETABLE_PRODUCTS.map((code) => [code, cardAssetUrl(PRODUCT_CARD_PATHS[code])]),
)

export function resolveCardImageUrl(productCode: string | null | undefined): string {
  if (!productCode) return FALLBACK_CARD_IMAGE
  const path = PRODUCT_CARD_PATHS[productCode as keyof typeof PRODUCT_CARD_PATHS]
  return path ? cardAssetUrl(path) : FALLBACK_CARD_IMAGE
}
