import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Chequeo activo real de conexión a Supabase (no solo navigator.onLine).
// Ejecuta un SELECT 1 con timeout corto. Lo consulta Electron al arrancar
// y de forma periódica antes de considerar la app "lista".
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 3000),
    );
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return NextResponse.json(
      { ok: true, db: "up", latencyMs: Date.now() - start },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
