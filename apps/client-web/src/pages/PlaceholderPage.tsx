import { Link } from 'react-router-dom'
import { InlineMessage } from '../components/InlineMessage'

// Écrans pas encore portés (étapes 3–6 du plan client-web) : le squelette
// route/auth est en place, le contenu métier sera repris depuis
// apps/admin-web/src/client/.
export function PlaceholderPage({ title, source }: { title: string; source: string }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <InlineMessage kind="info">
        Écran à venir — sera porté depuis <code>{source}</code>.
      </InlineMessage>
      <Link to="/">← Retour à l'accueil</Link>
    </div>
  )
}
