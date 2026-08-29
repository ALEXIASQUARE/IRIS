import { Component, type ErrorInfo, type ReactNode } from 'react'
import { InlineMessage } from './InlineMessage'

// Filet de sécurité : sans ça, une exception non rattrapée pendant le rendu
// d'un composant fait disparaître toute l'interface sans aucun message
// ("page blanche"), impossible à diagnostiquer depuis l'écran lui-même.
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non rattrapée :', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-main">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Une erreur est survenue</h2>
            <InlineMessage kind="error">{this.state.error.message}</InlineMessage>
            <p className="muted">
              Cette page a rencontré une erreur inattendue. Rafraîchissez pour réessayer ; si le
              problème persiste, signalez ce message.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Rafraîchir la page
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
