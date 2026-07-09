import "server-only";
import { prisma } from "@/lib/prisma";

type AccionAuditoria = "INSERT" | "UPDATE" | "DELETE";

/**
 * Registra una entrada en la bitácora de Auditoria.
 * Los triggers de BD ya cubren Obras y el stock de Materiales; este helper
 * cubre el resto de tablas (Clientes, Usuarios, Pagos, Presupuestos, etc.)
 * desde las Server Actions, asociando siempre al usuario de la sesión.
 */
export async function registrarAuditoria(params: {
  tabla: string;
  idRegistro: number;
  accion: AccionAuditoria;
  idUsuario?: number | null;
  datosAnteriores?: unknown;
  datosNuevos?: unknown;
}) {
  try {
    await prisma.auditoria.create({
      data: {
        tablaAfectada: params.tabla,
        idRegistro: params.idRegistro,
        accion: params.accion,
        idUsuario: params.idUsuario ?? null,
        datosAnteriores: (params.datosAnteriores ?? undefined) as never,
        datosNuevos: (params.datosNuevos ?? undefined) as never,
      },
    });
  } catch (err) {
    // La auditoría no debe tumbar la operación principal.
    console.error("[auditoria] no se pudo registrar:", err);
  }
}
