export type Journey = 'J1' | 'J2' | 'J3' | 'J4' | 'J5'
export type EconomicUnit = 'person' | 'pair' | 'team'
export type CapacityUnit = 'persons' | 'teams'

const JOURNEY_BY_CODE: Record<string, Journey> = {
  'DOB-VIE-MM': 'J2',
  'DOB-VIE-HH': 'J2',
  'DOB-VIE-MH': 'J2',
  'DOB-SAB-MM': 'J2',
  'DOB-SAB-HH': 'J2',
  'DOB-SAB-MH': 'J2',
  'REL-4H': 'J3',
  'REL-4M': 'J3',
  'REL-2H2M': 'J3',
  'IND-H': 'J1',
  'IND-M': 'J1',
  'IND-PRO-H': 'J1',
  'IND-PRO-M': 'J1',
  'HALF-IND-M': 'J1',
  'HALF-IND-H': 'J1',
  'HALF-DOB-MM': 'J2',
  'HALF-DOB-HH': 'J2',
  'HALF-DOB-MH': 'J2',
  'WOD-M': 'J4',
  'WOD-H': 'J4',
  'PUB-VIE': 'J5',
  'PUB-SAB': 'J5',
  'PUB-DOM': 'J5',
  'PUB-3D': 'J5',
  'FOT-VIE': 'J5',
  'FOT-SAB': 'J5',
  'FOT-DOM': 'J5',
  'FOT-3D': 'J5',
}

export function journeyForProductCode(code: string): Journey | null {
  return JOURNEY_BY_CODE[code] ?? null
}

export function economicUnitForJourney(journey: Journey, teamSize: number): EconomicUnit {
  if (journey === 'J3' || teamSize >= 4) return 'team'
  if (journey === 'J2' || teamSize === 2) return 'pair'
  return 'person'
}

export function capacityUnitForJourney(journey: Journey, teamSize: number): CapacityUnit {
  return economicUnitForJourney(journey, teamSize) === 'person' ? 'persons' : 'teams'
}

/** Capacity consumed per sold unit (one product purchase). */
export function capacityUnitsPerPurchase(): number {
  return 1
}
