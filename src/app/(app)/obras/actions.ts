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
  manoObraSchema,
  costoIndirectoSchema,
  type ActionResult,
} from "@/lib/validations";
import { getSupabaseAdmin, BUCKET_OBRAS } from "@/lib/supabase-admin";
import {
  ensureBucketObras,
  sanitizeName,
  MAX_ARCHIVO_BYTES,
  TIPOS_PERMITIDOS,
} from "@/lib/storage";

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
  igvPorcentaje?: number;
  detalles: { idMaterial: number; cantidadRequerida: number; precioUnitarioMomento: number }[];
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = presupuestoSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de presupuesto inválidos." };
  }
  const d = parsed.data;

  // Los importes (base, mermas ponderadas por material, subtotal, IGV y total)
  // los calcula el trigger `fn_presupuesto_recalcular` al tocar el detalle.
  // La app no duplica esa aritmética: la BD es la única fuente de verdad.
  let eraExistente = false;
  let idPresupuesto = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const existente = await tx.presupuesto.findUnique({ where: { idObra: d.idObra } });
      eraExistente = Boolean(existente);
      const detalles = {
        create: d.detalles.map((x) => ({
          idMaterial: x.idMaterial,
          cantidadRequerida: x.cantidadRequerida,
          precioUnitarioMomento: x.precioUnitarioMomento,
        })),
      };
      if (existente) {
        await tx.detallePresupuesto.deleteMany({ where: { idPresupuesto: existente.idPresupuesto } });
        await tx.presupuesto.update({
          where: { idPresupuesto: existente.idPresupuesto },
          data: {
            costoManoObra: d.costoManoObra,
            margenGananciaPorcentaje: d.margenGananciaPorcentaje,
            igvPorcentaje: d.igvPorcentaje,
            detalles,
          },
        });
        idPresupuesto = existente.idPresupuesto;
      } else {
        const creado = await tx.presupuesto.create({
          data: {
            idObra: d.idObra,
            costoManoObra: d.costoManoObra,
            margenGananciaPorcentaje: d.margenGananciaPorcentaje,
            igvPorcentaje: d.igvPorcentaje,
            fechaCreacion: new Date(),
            creadoPor: user.sub,
            detalles,
          },
        });
        idPresupuesto = creado.idPresupuesto;
      }
    });

    const final = await prisma.presupuesto.findUnique({ where: { idPresupuesto } });
    await registrarAuditoria({
      tabla: "Presupuestos",
      idRegistro: d.idObra,
      accion: eraExistente ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: {
        montoTotal: String(final?.montoTotal),
        costoMermas: String(final?.costoMermas),
      },
    });
    revalidatePath("/obras");
    return { ok: true, message: `Presupuesto guardado. Total con IGV: S/ ${final?.montoTotal ?? 0}.` };
  } catch {
    return { ok: false, error: "No se pudo guardar el presupuesto." };
  }
}

// ------------------- COSTEO REAL DE LA OBRA --------------------------

/** Registra horas-hombre imputadas a una obra (costo real de mano de obra). */
export async function registrarManoObra(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = manoObraSchema.safeParse({
    idObra: formData.get("idObra"),
    idUsuario: formData.get("idUsuario") || undefined,
    descripcion: formData.get("descripcion") || undefined,
    fecha: formData.get("fecha"),
    horas: formData.get("horas"),
    tarifaHora: formData.get("tarifaHora"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los datos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const reg = await prisma.manoObraObra.create({
      data: {
        idObra: d.idObra,
        idUsuario: d.idUsuario ?? null,
        descripcion: d.descripcion || null,
        fecha: new Date(d.fecha),
        horas: d.horas,
        tarifaHora: d.tarifaHora,
      },
    });
    await registrarAuditoria({
      tabla: "Mano_Obra_Obra",
      idRegistro: reg.idManoObra,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { idObra: d.idObra, horas: d.horas, costo: d.horas * d.tarifaHora },
    });
    revalidatePath("/obras");
    return { ok: true, message: `Registradas ${d.horas} h (S/ ${(d.horas * d.tarifaHora).toFixed(2)}).` };
  } catch {
    return { ok: false, error: "No se pudo registrar la mano de obra." };
  }
}

export async function eliminarManoObra(id: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.manoObraObra.delete({ where: { idManoObra: id } });
    await registrarAuditoria({ tabla: "Mano_Obra_Obra", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/obras");
    return { ok: true, message: "Registro eliminado." };
  } catch {
    return { ok: false, error: "No se pudo eliminar el registro." };
  }
}

/** Registra un costo indirecto imputado a una obra. */
export async function registrarCostoIndirecto(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = costoIndirectoSchema.safeParse({
    idObra: formData.get("idObra"),
    tipo: formData.get("tipo"),
    descripcion: formData.get("descripcion") || undefined,
    monto: formData.get("monto"),
    fecha: formData.get("fecha"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los datos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const reg = await prisma.costoIndirectoObra.create({
      data: {
        idObra: d.idObra,
        tipo: d.tipo,
        descripcion: d.descripcion || null,
        monto: d.monto,
        fecha: new Date(d.fecha),
        registradoPor: user.sub,
      },
    });
    await registrarAuditoria({
      tabla: "Costos_Indirectos_Obra",
      idRegistro: reg.idCostoIndirecto,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { idObra: d.idObra, tipo: d.tipo, monto: d.monto },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Costo indirecto registrado." };
  } catch {
    return { ok: false, error: "No se pudo registrar el costo." };
  }
}

export async function eliminarCostoIndirecto(id: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.costoIndirectoObra.delete({ where: { idCostoIndirecto: id } });
    await registrarAuditoria({ tabla: "Costos_Indirectos_Obra", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/obras");
    return { ok: true, message: "Costo eliminado." };
  } catch {
    return { ok: false, error: "No se pudo eliminar el costo." };
  }
}

/** Sube un boceto/plano (imagen o PDF) a Storage y lo asocia a la obra. */
export async function subirArchivoObra(idObra: number, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona un archivo." };
  }
  if (file.size > MAX_ARCHIVO_BYTES) {
    return { ok: false, error: "El archivo supera el límite de 15 MB." };
  }
  if (file.type && !TIPOS_PERMITIDOS.includes(file.type)) {
    return { ok: false, error: "Formato no permitido. Usa una imagen (PNG/JPG/WEBP) o PDF." };
  }

  try {
    await ensureBucketObras();
    const sb = getSupabaseAdmin();
    const bytes = Buffer.from(await file.arrayBuffer());
    const path = `${idObra}/${Date.now()}-${sanitizeName(file.name)}`;

    const { error } = await sb.storage
      .from(BUCKET_OBRAS)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) {
      return { ok: false, error: "No se pudo subir el archivo a Storage." };
    }

    const archivo = await prisma.obraArchivo.create({
      data: {
        idObra,
        path,
        nombre: file.name,
        tipoMime: file.type || null,
        tamanoBytes: file.size,
        subidoPor: user.sub,
      },
    });
    await registrarAuditoria({
      tabla: "Obra_Archivos",
      idRegistro: archivo.idArchivo,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { idObra, nombre: file.name },
    });
    revalidatePath("/obras");
    return { ok: true, message: "Boceto subido." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Storage no configurado")) {
      return { ok: false, error: "Storage no configurado (faltan variables de Supabase)." };
    }
    return { ok: false, error: "No se pudo subir el archivo." };
  }
}

/** Elimina un boceto/plano de la obra (Storage + registro). */
export async function eliminarArchivoObra(idArchivo: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const archivo = await prisma.obraArchivo.findUnique({ where: { idArchivo } });
    if (!archivo) return { ok: false, error: "Archivo no encontrado." };

    const sb = getSupabaseAdmin();
    await sb.storage.from(BUCKET_OBRAS).remove([archivo.path]);
    await prisma.obraArchivo.delete({ where: { idArchivo } });

    await registrarAuditoria({
      tabla: "Obra_Archivos",
      idRegistro: idArchivo,
      accion: "DELETE",
      idUsuario: user.sub,
    });
    revalidatePath("/obras");
    return { ok: true, message: "Archivo eliminado." };
  } catch {
    return { ok: false, error: "No se pudo eliminar el archivo." };
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
