"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import {
  obraSchema,
  avanceSchema,
  presupuestoSchema,
  pagoSchema,
  type ActionResult,
} from "@/lib/validations";

export async function crearObra(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = obraSchema.safeParse({
    idCliente: formData.get("idCliente"),
    nombreObra: formData.get("nombreObra"),
    descripcion: formData.get("descripcion") || undefined,
    tipoObra: formData.get("tipoObra") || undefined,
    ubicacion: formData.get("ubicacion") || undefined,
    fechaInicio: formData.get("fechaInicio"),
    fechaEntregaEstimada: formData.get("fechaEntregaEstimada"),
    estadoObra: formData.get("estadoObra") || "Presupuestando",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    // El trigger trg_obras_audit registra la auditoría automáticamente (usa creado_por).
    const obra = await prisma.obra.create({
      data: {
        idCliente: d.idCliente,
        nombreObra: d.nombreObra,
        descripcion: d.descripcion || null,
        tipoObra: d.tipoObra || null,
        ubicacion: d.ubicacion || null,
        fechaInicio: new Date(d.fechaInicio),
        fechaEntregaEstimada: new Date(d.fechaEntregaEstimada),
        estadoObra: d.estadoObra,
        creadoPor: user.sub,
      },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Obra creada.", data: obra.idObra };
  } catch {
    return { ok: false, error: "No se pudo crear la obra." };
  }
}

export async function actualizarObra(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("idObra"));
  const parsed = obraSchema.safeParse({
    idCliente: formData.get("idCliente"),
    nombreObra: formData.get("nombreObra"),
    descripcion: formData.get("descripcion") || undefined,
    tipoObra: formData.get("tipoObra") || undefined,
    ubicacion: formData.get("ubicacion") || undefined,
    fechaInicio: formData.get("fechaInicio"),
    fechaEntregaEstimada: formData.get("fechaEntregaEstimada"),
    estadoObra: formData.get("estadoObra") || "Presupuestando",
  });
  if (!id || !parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    await prisma.obra.update({
      where: { idObra: id },
      data: {
        idCliente: d.idCliente,
        nombreObra: d.nombreObra,
        descripcion: d.descripcion || null,
        tipoObra: d.tipoObra || null,
        ubicacion: d.ubicacion || null,
        fechaInicio: new Date(d.fechaInicio),
        fechaEntregaEstimada: new Date(d.fechaEntregaEstimada),
        estadoObra: d.estadoObra,
        actualizadoPor: user.sub,
      },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Obra actualizada." };
  } catch {
    return { ok: false, error: "No se pudo actualizar la obra." };
  }
}

export async function actualizarAvance(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = avanceSchema.safeParse({
    idObra: formData.get("idObra"),
    porcentajeAvance: formData.get("porcentajeAvance"),
    estadoObra: formData.get("estadoObra"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise el avance.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    await prisma.obra.update({
      where: { idObra: d.idObra },
      data: {
        porcentajeAvance: d.porcentajeAvance,
        estadoObra: d.estadoObra,
        actualizadoPor: user.sub,
        // Si se marca Finalizado y no tiene fecha real, registrarla.
        ...(d.estadoObra === "Finalizado" ? { fechaEntregaReal: new Date() } : {}),
      },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Progreso actualizado." };
  } catch {
    return { ok: false, error: "No se pudo actualizar el progreso." };
  }
}

export async function eliminarObra(id: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const pagos = await prisma.pagoObra.count({ where: { idObra: id } });
    if (pagos > 0) {
      await prisma.obra.update({ where: { idObra: id }, data: { estadoObra: "Cancelado", actualizadoPor: user.sub } });
      return { ok: true, message: "La obra tiene pagos registrados: se marcó como Cancelada." };
    }
    // El presupuesto se borra en cascada (FK ON DELETE CASCADE).
    await prisma.obra.delete({ where: { idObra: id } });
    await registrarAuditoria({ tabla: "Obras", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/obras");
    return { ok: true, message: "Obra eliminada." };
  } catch {
    return { ok: false, error: "No se pudo eliminar la obra (¿tiene movimientos asociados?)." };
  }
}

/** Crea o reemplaza el presupuesto de una obra (relación 1:1). */
export async function guardarPresupuesto(payload: {
  idObra: number;
  costoManoObra: number;
  margenGananciaPorcentaje: number;
  detalles: { idMaterial: number; cantidadRequerida: number; precioUnitarioMomento: number }[];
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = presupuestoSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de presupuesto inválidos." };
  }
  const d = parsed.data;

  const costoMaterialesBase = d.detalles.reduce(
    (s, x) => s + x.cantidadRequerida * x.precioUnitarioMomento,
    0,
  );
  const costoMermas = Math.round(costoMaterialesBase * 0.06 * 100) / 100; // 6% (igual que el trigger)
  const subtotal = costoMaterialesBase + costoMermas + d.costoManoObra;
  const montoTotal = Math.round(subtotal * (1 + d.margenGananciaPorcentaje / 100) * 100) / 100;

  let eraExistente = false;
  try {
    await prisma.$transaction(async (tx) => {
      const existente = await tx.presupuesto.findUnique({ where: { idObra: d.idObra } });
      eraExistente = Boolean(existente);
      if (existente) {
        await tx.detallePresupuesto.deleteMany({ where: { idPresupuesto: existente.idPresupuesto } });
        await tx.presupuesto.update({
          where: { idPresupuesto: existente.idPresupuesto },
          data: {
            costoManoObra: d.costoManoObra,
            costoMaterialesBase, // el trigger recalcula costo_mermas
            margenGananciaPorcentaje: d.margenGananciaPorcentaje,
            montoTotal,
            detalles: {
              create: d.detalles.map((x) => ({
                idMaterial: x.idMaterial,
                cantidadRequerida: x.cantidadRequerida,
                precioUnitarioMomento: x.precioUnitarioMomento,
              })),
            },
          },
        });
      } else {
        await tx.presupuesto.create({
          data: {
            idObra: d.idObra,
            costoManoObra: d.costoManoObra,
            costoMaterialesBase,
            costoMermas,
            margenGananciaPorcentaje: d.margenGananciaPorcentaje,
            montoTotal,
            fechaCreacion: new Date(),
            creadoPor: user.sub,
            detalles: {
              create: d.detalles.map((x) => ({
                idMaterial: x.idMaterial,
                cantidadRequerida: x.cantidadRequerida,
                precioUnitarioMomento: x.precioUnitarioMomento,
              })),
            },
          },
        });
      }
    });
    await registrarAuditoria({
      tabla: "Presupuestos",
      idRegistro: d.idObra,
      accion: eraExistente ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: { montoTotal, costoMaterialesBase, costoMermas },
    });
    revalidatePath("/obras");
    return { ok: true, message: `Presupuesto guardado. Monto total: ${montoTotal.toFixed(2)}.` };
  } catch {
    return { ok: false, error: "No se pudo guardar el presupuesto." };
  }
}

export async function registrarPago(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = pagoSchema.safeParse({
    idObra: formData.get("idObra"),
    montoAbonado: formData.get("montoAbonado"),
    fechaPago: formData.get("fechaPago"),
    tipoPago: formData.get("tipoPago"),
    observaciones: formData.get("observaciones") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los datos del pago.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const pago = await prisma.pagoObra.create({
      data: {
        idObra: d.idObra,
        montoAbonado: d.montoAbonado,
        fechaPago: new Date(d.fechaPago),
        tipoPago: d.tipoPago,
        observaciones: d.observaciones || null,
        registradoPor: user.sub,
      },
    });
    await registrarAuditoria({
      tabla: "Pagos_Obras",
      idRegistro: pago.idPago,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { montoAbonado: d.montoAbonado, idObra: d.idObra },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Pago registrado." };
  } catch {
    return { ok: false, error: "No se pudo registrar el pago." };
  }
}
