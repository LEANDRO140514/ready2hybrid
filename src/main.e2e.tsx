import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import {
  createFixtureAuthPort,
  createFixtureAuthorizationPort,
} from './auth/fixture-ports'
import { createMemoryPartnersPort } from './partners/memory'
import { createHarnessSalesPort } from './sales-dashboard/harness-snapshot'
import './index.css'

/**
 * Playwright harness entry (vite --mode e2e only).
 * Not referenced by production `main.tsx`.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      authPort={createFixtureAuthPort()}
      authorizationPort={createFixtureAuthorizationPort()}
      salesPort={createHarnessSalesPort()}
      partnersPort={createMemoryPartnersPort([
        {
          code: 'ENFORMA',
          studioName: 'Enforma',
          contactName: 'Responsable Enforma',
          phone: '9991111111',
          email: 'studio@example.com',
          active: true,
          createdAt: '2026-09-01T06:00:00.000Z',
          locksLaunchPrice: true,
        },
      ])}
    />
  </StrictMode>,
)
