"use client"; // Reemplaza al layout raíz cuando falla; por eso trae su propio <html> y estilos en línea.

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6efe3",
          color: "#2b2118",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <title>La tienda no está disponible</title>
        <main style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 30 }}>La tienda no está disponible en este momento</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#5a4430", lineHeight: 1.5 }}>
            Estamos teniendo un problema para cargar la tienda. Vuelve a intentarlo en unos minutos.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              height: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 10,
              background: "#1f4d3a",
              color: "#f6efe3",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
