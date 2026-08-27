import { Component, type ErrorInfo, type ReactNode } from 'react';

// Filet de sécurité pour tout le Testeur : sans ça, une exception non
// rattrapée pendant le rendu d'un composant (ex: .toFixed() appelé sur une
// chaîne — voir AdminBookings.tsx, un Decimal Prisma sérialisé en JSON
// n'est jamais un number) faisait disparaître toute l'interface sans
// aucun message ("page blanche"), impossible à diagnostiquer depuis
// l'écran lui-même.
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non rattrapée dans le Testeur :', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: 24 }}>
          <h2>Une erreur est survenue</h2>
          <p className="error">{this.state.error.message}</p>
          <p className="muted">
            Cette section a rencontré une erreur inattendue au lieu de s'afficher normalement. Rafraîchissez la
            page pour réessayer ; si le problème persiste, signalez ce message d'erreur.
          </p>
          <button onClick={() => window.location.reload()}>Rafraîchir la page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
