"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { materialSchema, movimientoSchema, type ActionResult } from "@/lib/validations";

function parseMaterial(formData: FormData) {
  return materialSchema.safeParse({
    codigoMaterial: formData.get("codigoMaterial"),
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion") || undefined,
    categoria: formData.get("categoria"),
    unidadMedida: formData.get("unidadMedida"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    stockMaximo: formData.get("stockMaximo") || undefined,
    cupp: formData.get("cupp") || 0,
    areaAlmacen: formData.get("areaAlmacen") || undefined,
    estanteNivel: formData.get("estanteNivel") || undefined,
    estado: formData.get("estado") || "Activo",
  });
}

export async function crearMaterial(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseMaterial(formData);
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const material = await prisma.material.create({
      data: {
        codigoMaterial: d.codigoMaterial,
        nombre: d.nombre,
        descripcion: d.descripcion || null,
        categoria: d.categoria,
        unidadMedida: d.unidadMedida,
        stockActual: d.stockActual, // saldo inicial de apertura
        stockMinimo: d.stockMinimo,
        stockMaximo: d.stockMaximo ?? null,
        cupp: d.cupp,
        areaAlmacen: d.areaAlmacen || null,
        estanteNivel: d.estanteNivel || null,
        estado: d.estado,
      },
    });
    await registrarAuditoria({
      tabla: "Materiales",
      idRegistro: material.idMaterial,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { codigoMaterial: material.codigoMaterial, nombre: material.nombre },
    });
    revalidatePath("/inventario");
    return { ok: true, message: "Material registrado." };
  } catch (e) {
    return { ok: false, error: uniqueErr(e, "código de material") };
  }
}

export async function actualizarMaterial(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("idMaterial"));
  const parsed = parseMaterial(formData);
  if (!id || !parsed.success) {
    return {
      ok: false,
      error: "Revise los campos.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  try {
    // NO se actualiza stockActual directamente: el stock solo cambia vía movimientos (kardex).
    await prisma.material.update({
      where: { idMaterial: id },
      data: {
        codigoMaterial: d.codigoMaterial,
        nombre: d.nombre,
        descripcion: d.descripcion || null,
        categoria: d.categoria,
        unidadMedida: d.unidadMedida,
        stockMinimo: d.stockMinimo,
        stockMaximo: d.stockMaximo ?? null,
        cupp: d.cupp,
        areaAlmacen: d.areaAlmacen || null,
        estanteNivel: d.estanteNivel || null,
        estado: d.estado,
      },
    });
    await registrarAuditoria({ tabla: "Materiales", idRegistro: id, accion: "UPDATE", idUsuario: user.sub });
    revalidatePath("/inventario");
    revalidatePath("/precios");
    return { ok: true, message: "Material actualizado." };
  } catch (e) {
    return { ok: false, error: uniqueErr(e, "código de material") };
  }
}

export async function eliminarMaterial(id: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const movimientos = await prisma.movimientoInventario.count({ where: { idMaterial: id } });
    const enPresupuesto = await prisma.detallePresupuesto.count({ where: { idMaterial: id } });
    if (movimientos > 0 || enPresupuesto > 0) {
      // Tiene historial: baja lógica (Descontinuado) en vez de borrar.
      await prisma.material.update({ where: { idMaterial: id }, data: { estado: "Descontinuado" } });
      await registrarAuditoria({ tabla: "Materiales", idRegistro: id, accion: "UPDATE", idUsuario: user.sub, datosNuevos: { estado: "Descontinuado" } });
      return { ok: true, message: "El material tiene historial: se marcó como Descontinuado." };
    }
    await prisma.material.delete({ where: { idMaterial: id } });
    await registrarAuditoria({ tabla: "Materiales", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/inventario");
    return { ok: true, message: "Material eliminado." };
  } catch {
    return { ok: false, error: "No se pudo eliminar el material." };
  }
}

/**
 * Registra un movimiento de inventario (kardex). El stock NO se toca aquí:
 * el trigger `trg_movimientos_before_insert` valida el stock y calcula el
 * saldo_resultante, y `trg_movimientos_after_insert` actualiza Materiales.
 * Si no hay stock para una Salida, el trigger lanza excepción y la capturamos.
 */
export async function registrarMovimiento(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = movimientoSchema.safeParse({
    idMaterial: formData.get("idMaterial"),
    idObra: formData.get("idObra") || undefined,
    tipoMovimiento: formData.get("tipoMovimiento"),
    cantidad: formData.get("cantidad"),
    costoUnitario: formData.get("costoUnitario") || 0,
    motivo: formData.get("motivo") || undefined,
    referenciaDocumento: formData.get("referenciaDocumento") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los datos del movimiento.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const mov = await prisma.movimientoInventario.create({
      data: {
        idMaterial: d.idMaterial,
        idObra: d.idObra ?? null,
        tipoMovimiento: d.tipoMovimiento,
        cantidad: d.cantidad,
        saldoResultante: 0, // el trigger lo recalcula en BEFORE INSERT
        costoUnitario: d.costoUnitario,
        motivo: d.motivo || null,
        referenciaDocumento: d.referenciaDocumento || null,
        idUsuario: user.sub,
      },
    });
    revalidatePath("/inventario");
    revalidatePath("/precios");
    return {
      ok: true,
      message: `${d.tipoMovimiento} registrada. Nuevo saldo: ${mov.saldoResultante}.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Stock insuficiente")) {
      return { ok: false, error: "Stock insuficiente para realizar la salida." };
    }
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

function uniqueErr(e: unknown, field: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique") || msg.includes("P2002") || msg.includes("uq_")) {
    return `Ya existe un material con ese ${field}.`;
  }
  return "No se pudo completar la operación.";
}
