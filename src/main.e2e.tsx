import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import {
  createFixtureAuthPort,
  createFixtureAuthorizationPort,
} from './auth/fixture-ports'
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
    />
  </StrictMode>,
)
