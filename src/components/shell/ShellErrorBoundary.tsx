import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

/**
 * Captures shell render failures. Authorization denials use dedicated routes
 * (UNAUTHORIZED) and must not be funneled here.
 */
export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Safe diagnostic only — no tokens, session payloads, or PII.
    console.error('[shell] RENDER_FAILURE', {
      name: error.name,
      message: error.message.slice(0, 160),
      componentStack: info.componentStack?.slice(0, 240) ?? null,
    })
  }

  private recover = (): void => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section data-testid="shell-render-failure" className="error-boundary">
          <h1>Error del shell</h1>
          <p>
            La interfaz operativa encontró un fallo de presentación
            (RENDER_FAILURE). Esto no es un denegado de autorización
            (UNAUTHORIZED) ni un estado de sesión.
          </p>
          <p className="muted">
            Puedes recargar el shell o volver al inicio de forma segura.
          </p>
          <button type="button" onClick={this.recover}>
            Volver al inicio
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
