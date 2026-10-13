import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { ACTIVE_EVENT_CODE } from '../../sales-dashboard/commercial'
import { useSalesPort, type CommercialPayload } from '../../sales-dashboard/port'
import type { SalesSnapshot } from '../../sales-dashboard/model'
import { FinanceDashboard } from './FinanceDashboard'

const EMPTY_COMMERCIAL: CommercialPayload = {
  eventCode: ACTIVE_EVENT_CODE,
  legacy: [],
  funnel: [],
}

export function FinancePage({ now }: { now?: Date }) {
  const port = useSalesPort()
  const { role } = useAuth()
  const [snapshot, setSnapshot] = useState<SalesSnapshot | null>(null)
  const [commercial, setCommercial] = useState<CommercialPayload>(EMPTY_COMMERCIAL)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (role !== 'OWNER' || !port.loadCommercial) return
    setCommercial(await port.loadCommercial('rows'))
  }, [port, role])

  useEffect(() => {
    let cancelled = false
    setSnapshot(null)
    setError(null)
    Promise.all([
      port.loadSnapshot(),
      port.loadCommercial
        ? port.loadCommercial('aggregates')
        : Promise.resolve(EMPTY_COMMERCIAL),
    ])
      .then(([next, history]) => {
        if (!cancelled) {
          setSnapshot(next)
          setCommercial(history)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudo leer el control de ventas.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [port, role])

  if (error) {
    return (
      <p role="alert" data-testid="finance-error">
        {error}
      </p>
    )
  }
  if (!snapshot) {
    return <p data-testid="finance-loading">Cargando ventas…</p>
  }
  return (
    <FinanceDashboard
      snapshot={snapshot}
      commercial={commercial}
      role={role}
      now={now}
      onLoadDetail={role === 'OWNER' ? loadDetail : undefined}
      onSaveAdjustment={async (input) => {
        await port.saveAdjustment(input)
        setSnapshot(await port.loadSnapshot())
      }}
    />
  )
}
