"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { cotizacionSchema, type ActionResult } from "@/lib/validations";
import { toNumber } from "@/lib/utils";

export type CotizacionGuardada = {
  idCotizacion: number;
  nombreCliente: string;
  dniRuc: string | null;
  telefono: string | null;
  correo: string | null;
  producto: string;
  descripcion: string | null;
  medidas: string | null;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  tiempoEntrega: string | null;
  validezDias: number;
  creadoEn: string;
};

/**
 * Guarda una cotización rápida. Valida con Zod, exige sesión y registra
 * auditoría — alineado con el resto de los módulos del sistema.
 * Devuelve un objeto plano listo para el generador de PDF del cliente.
 */
export async function saveCotizacionAction(
  formData: FormData,
): Promise<ActionResult<CotizacionGuardada>> {
  const user = await requireUser();

  const parsed = cotizacionSchema.safeParse({
    idCliente: formData.get("idCliente") || undefined,
    nombreCliente: formData.get("nombreCliente"),
    dniRuc: formData.get("dniRuc") || undefined,
    telefono: formData.get("telefono") || undefined,
    correo: formData.get("correo") || undefined,
    producto: formData.get("producto"),
    descripcion: formData.get("descripcion") || undefined,
    medidas: formData.get("medidas") || undefined,
    cantidad: formData.get("cantidad"),
    precioUnitario: formData.get("precioUnitario"),
    tiempoEntrega: formData.get("tiempoEntrega") || undefined,
    validezDias: formData.get("validezDias") || 7,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revise los datos de la cotización.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const precioTotal = Math.round(d.cantidad * d.precioUnitario * 100) / 100;

  try {
    const cot = await prisma.cotizacionRapida.create({
      data: {
        nombreCliente: d.nombreCliente,
        dniRuc: d.dniRuc || null,
        telefono: d.telefono || null,
        correo: d.correo || null,
        producto: d.producto,
        descripcion: d.descripcion || null,
        medidas: d.medidas || null,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        precioTotal,
        tiempoEntrega: d.tiempoEntrega || null,
        validezDias: d.validezDias,
      },
    });

    await registrarAuditoria({
      tabla: "Cotizacion_Rapida",
      idRegistro: cot.idCotizacion,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { producto: d.producto, cliente: d.nombreCliente, total: precioTotal },
    });

    revalidatePath("/cotizador");

    return {
      ok: true,
      message: "Cotización guardada.",
      data: {
        idCotizacion: cot.idCotizacion,
        nombreCliente: cot.nombreCliente,
        dniRuc: cot.dniRuc,
        telefono: cot.telefono,
        correo: cot.correo,
        producto: cot.producto,
        descripcion: cot.descripcion,
        medidas: cot.medidas,
        cantidad: cot.cantidad,
        precioUnitario: toNumber(cot.precioUnitario),
        precioTotal: toNumber(cot.precioTotal),
        tiempoEntrega: cot.tiempoEntrega,
        validezDias: cot.validezDias,
        creadoEn: cot.creadoEn.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "No se pudo guardar la cotización." };
  }
}

/** Lista de clientes activos para el selector del cotizador. */
export async function clientesParaCotizar() {
  await requireUser();
  return prisma.cliente.findMany({
    where: { estado: "Activo" },
    select: {
      idCliente: true,
      nombreRazonSocial: true,
      identificacionFiscal: true,
      telefono: true,
      correo: true,
    },
    orderBy: { nombreRazonSocial: "asc" },
  });
}
