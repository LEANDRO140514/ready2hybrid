import { useState } from 'react'

import { applyTreasuryCommand } from '../../treasury/memory'
import type { TreasuryBooks } from '../../treasury/books'
import { TreasuryDesk } from './TreasuryDesk'

const EMPTY: TreasuryBooks = { accounts: [], categories: [], movements: [] }

export function TreasuryPage({
  initial = EMPTY,
  actor = 'local',
  role = 'FINANCE',
  excludedSalesCents,
}: {
  initial?: TreasuryBooks
  actor?: string
  role?: string
  excludedSalesCents?: number
}) {
  const [books, setBooks] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  if (role === 'MARKETING') return <p role="alert">MARKETING no entra a tesorería.</p>

  return (
    <TreasuryDesk
      books={books}
      error={error}
      excludedSalesCents={excludedSalesCents}
      onSave={async (body) => {
        const result = applyTreasuryCommand(books, body, actor)
        if (!result.ok) {
          setError(result.code)
          return false
        }
        setError(null)
        setBooks(result.books)
        return true
      }}
    />
  )
}
