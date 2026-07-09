"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { type ActionResult } from "@/lib/validations";
import { toNumber, formatCurrency } from "@/lib/utils";

const cuppSchema = z.coerce.number().min(0, "El CUPP no puede ser negativo.");

/** Actualiza manualmente el CUPP (costo unitario promedio ponderado) de un material. */
export async function actualizarCupp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const id = Number(formData.get("idMaterial"));
  if (!id) return { ok: false, error: "Material no válido." };

  const parsed = cuppSchema.safeParse(formData.get("cupp"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "CUPP inválido." };
  }

  try {
    const material = await prisma.material.findUnique({
      where: { idMaterial: id },
      select: { cupp: true, nombre: true },
    });
    if (!material) return { ok: false, error: "El material no existe." };

    const anterior = toNumber(material.cupp);
    const nuevo = parsed.data;

    await prisma.material.update({
      where: { idMaterial: id },
      data: { cupp: nuevo },
    });

    await registrarAuditoria({
      tabla: "Materiales",
      idRegistro: id,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosAnteriores: { cupp: anterior },
      datosNuevos: { cupp: nuevo },
    });

    revalidatePath("/precios");
    return { ok: true, message: `Costo actualizado a ${formatCurrency(nuevo)}.` };
  } catch {
    return { ok: false, error: "No se pudo actualizar el costo." };
  }
}

/**
 * Recalcula el CUPP como promedio ponderado de las entradas con costo:
 * CUPP = sum(cantidad * costoUnitario) / sum(cantidad).
 */
export async function recalcularCupp(idMaterial: number): Promise<ActionResult> {
  const user = await requireUser();

  if (!idMaterial) return { ok: false, error: "Material no válido." };

  try {
    const material = await prisma.material.findUnique({
      where: { idMaterial },
      select: { cupp: true },
    });
    if (!material) return { ok: false, error: "El material no existe." };

    const entradas = await prisma.movimientoInventario.findMany({
      where: {
        idMaterial,
        tipoMovimiento: "Entrada",
        costoUnitario: { gt: 0 },
      },
      select: { cantidad: true, costoUnitario: true },
    });

    if (entradas.length === 0) {
      return { ok: false, error: "No hay entradas con costo para calcular el CUPP." };
    }

    let sumaValor = 0;
    let sumaCantidad = 0;
    for (const e of entradas) {
      const cantidad = toNumber(e.cantidad);
      const costo = toNumber(e.costoUnitario);
      sumaValor += cantidad * costo;
      sumaCantidad += cantidad;
    }

    if (sumaCantidad <= 0) {
      return { ok: false, error: "No hay entradas con costo para calcular el CUPP." };
    }

    const anterior = toNumber(material.cupp);
    const nuevo = Number((sumaValor / sumaCantidad).toFixed(2));

    await prisma.material.update({
      where: { idMaterial },
      data: { cupp: nuevo },
    });

    await registrarAuditoria({
      tabla: "Materiales",
      idRegistro: idMaterial,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosAnteriores: { cupp: anterior },
      datosNuevos: { cupp: nuevo },
    });

    revalidatePath("/precios");
    return { ok: true, message: `CUPP recalculado: ${formatCurrency(nuevo)}.` };
  } catch {
    return { ok: false, error: "No se pudo recalcular el CUPP." };
  }
}
