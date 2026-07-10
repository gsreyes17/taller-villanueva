"use client";

// Captura errores en el layout raíz. Debe declarar su propio <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "linear-gradient(180deg, #fdf6ec 0%, #fbeee0 100%)",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Algo salió mal</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
            La aplicación encontró un error inesperado.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              cursor: "pointer",
              background: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 22px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
