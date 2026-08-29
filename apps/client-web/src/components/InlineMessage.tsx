// Encadré contextuel uniforme (erreur / succès / info) — pendant web de
// InlineMessage côté Flutter (apps/mobile/lib/widgets/inline_message.dart).

type Kind = 'error' | 'success' | 'info'

const ICON: Record<Kind, string> = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
}

export function InlineMessage({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  return (
    <div className={`msg ${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <span aria-hidden="true">{ICON[kind]}</span>
      <span>{children}</span>
    </div>
  )
}
