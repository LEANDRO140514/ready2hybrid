import { useCallback, useEffect, useState } from 'react'

import { loadTreasury, saveTreasury } from '../../treasury/port'
import type { TreasuryBooks } from '../../treasury/books'
import { TreasuryDesk } from './TreasuryDesk'

export function TreasuryLive() {
  const [books, setBooks] = useState<TreasuryBooks | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setBooks(await loadTreasury())
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTreasury()
      .then((next) => {
        if (!cancelled) setBooks(next)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'No se pudo leer tesorería.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!books) return <p role={error ? 'alert' : undefined}>{error ?? 'Cargando tesorería…'}</p>

  return (
    <div data-testid="treasury-live">
      <TreasuryDesk
        books={books}
        error={error}
        onSave={async (body) => {
          try {
            await saveTreasury(body)
            setError(null)
            await reload()
            return true
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'REJECTED')
            return false
          }
        }}
      />
    </div>
  )
}
