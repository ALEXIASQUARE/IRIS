export function Spinner({ center = false }: { center?: boolean }) {
  return <span className={center ? 'spinner center' : 'spinner'} role="status" aria-label="Chargement" />
}
