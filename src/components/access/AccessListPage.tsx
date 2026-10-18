import { useEffect, useMemo, useState } from 'react'

import {
  accessListToCsv,
  filterAccessPeople,
  type AccessPerson,
} from '../../access/list'
import { getInsforgeClient } from '../../lib/insforge/client'
import { postProjectFunction } from '../../lib/insforge/project-function'

export function AccessListPage({ people }: { people: AccessPerson[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterAccessPeople(people, query), [people, query])

  function exportCsv() {
    const blob = new Blob([accessListToCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lista-de-acceso.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="access-sheet">
      <div className="no-print filter-grid">
        <label>
          Buscar
          <input
            value={query}
            placeholder="Nombre, correo, teléfono o referencia"
            onChange={(event) => setQuery(event.target.value)}
            data-testid="access-search"
          />
        </label>
        <div className="chip-row">
          <button type="button" onClick={exportCsv} data-testid="access-csv">Exportar CSV</button>
          <button type="button" onClick={() => window.print()} data-testid="access-print">Imprimir</button>
          <span className="muted" data-testid="access-count">{visible.length} personas con acceso</span>
        </div>
      </div>
      <table className="access-table" data-testid="access-table">
        <thead>
          <tr>
            <th>Día</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Teléfono</th>
            <th>Categoría</th>
            <th>Equipo</th>
            <th>Origen</th>
            <th>Referencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((person) => (
            <tr key={`${person.reference}:${person.name}`} data-testid="access-row">
              <td>{person.session ?? '—'}</td>
              <td>{person.name}</td>
              <td>{person.email ?? '—'}</td>
              <td>{person.phone ?? '—'}</td>
              <td>{person.category}</td>
              <td>{person.team ?? '—'}</td>
              <td>{person.origin}</td>
              <td>{person.reference}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 ? <p>Nadie coincide con la búsqueda.</p> : null}
    </div>
  )
}

export function AccessLive() {
  const [people, setPeople] = useState<AccessPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    postProjectFunction<{ ok?: boolean; people?: AccessPerson[] }>(
      getInsforgeClient(),
      'ops-access-read',
      {},
    )
      .then((body) => {
        if (cancelled) return
        if (!body?.ok || !Array.isArray(body.people)) {
          setError('No se pudo leer la lista de acceso.')
          return
        }
        setPeople(body.people)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo leer la lista de acceso.')
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (error) return <p role="alert">{error}</p>
  if (!people) return <p data-testid="access-loading">Cargando lista de acceso…</p>
  return <AccessListPage people={people} />
}
