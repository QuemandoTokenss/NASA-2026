import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Página no encontrada</h1>
      <p className="mt-2 text-sm text-ink-muted">Esta ruta no existe en SITE REGRET.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg border border-line-strong bg-surface-2 px-4 py-2 text-sm text-ink hover:bg-surface-3">
        Volver al inicio
      </Link>
    </div>
  );
}
