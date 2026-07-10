import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para empaquetar en Electron: genera un build "standalone"
  // que incluye solo las dependencias usadas y puede correr con `node server.js`.
  output: "standalone",
  // El cliente de Prisma generado y pg son externos al bundle del servidor.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Asegura que el cliente Prisma generado se incluya en el build standalone
  // (Electron corre ese server embebido y debe encontrarlo en runtime).
  outputFileTracingIncludes: {
    "/**": ["./prisma/generated/**/*"],
  },
  experimental: {
    // Permite subir bocetos/planos (imágenes/PDF) vía Server Actions.
    serverActions: { bodySizeLimit: "15mb" },
  },
  eslint: {
    // No bloquear el build de Electron por lint; el lint se corre aparte.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
