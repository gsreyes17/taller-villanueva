import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-app flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl font-bold text-brand">404</p>
        <h1 className="mt-3 text-lg font-bold text-ink">Página no encontrada</h1>
        <p className="mt-1 text-sm text-muted">La página que buscas no existe o fue movida.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
