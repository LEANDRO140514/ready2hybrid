import { FinanceDashboard } from '../components/finance/FinanceDashboard'
import {
  HARNESS_FUNNEL,
  HARNESS_LEGACY,
  HARNESS_SNAPSHOT,
} from '../sales-dashboard/harness-snapshot'

const PREVIEW_NOW = new Date('2026-09-23T18:00:00.000Z')

export function DashboardPreviewPage() {
  if (!import.meta.env.DEV) {
    return <p>Esta vista solo existe en el servidor local.</p>
  }
  return (
    <div>
      <p role="note" data-testid="preview-banner">
        Vista previa local. Todas las personas, fechas y montos de esta pantalla son de ejemplo.
      </p>
      <FinanceDashboard
        snapshot={HARNESS_SNAPSHOT}
        commercial={{
          eventCode: 'HEX-2026',
          legacy: HARNESS_LEGACY,
          funnel: HARNESS_FUNNEL,
        }}
        role="OWNER"
        now={PREVIEW_NOW}
      />
    </div>
  )
}
