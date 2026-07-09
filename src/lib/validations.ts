import { z } from "zod";

// --------------------------- Auth ------------------------------------
export const loginSchema = z.object({
  nombreUsuario: z.string().trim().min(1, "Ingrese su usuario"),
  contrasena: z.string().min(1, "Ingrese su contraseña"),
});

// --------------------------- Usuarios --------------------------------
export const usuarioCreateSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(50),
    apellido: z.string().trim().min(1, "El apellido es obligatorio").max(50),
    nombreUsuario: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo"),
    contrasena: z.string().min(6, "Mínimo 6 caracteres"),
    confirmarContrasena: z.string(),
    rol: z.enum(["Administrador", "Trabajador"]),
    estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
  })
  .refine((d) => d.contrasena === d.confirmarContrasena, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarContrasena"],
  });

export const usuarioUpdateSchema = z.object({
  idUsuario: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(1).max(50),
  apellido: z.string().trim().min(1).max(50),
  rol: z.enum(["Administrador", "Trabajador"]),
  estado: z.enum(["Activo", "Inactivo"]),
  // opcional: cambiar contraseña
  contrasena: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
});

// --------------------------- Clientes --------------------------------
// Nota: los valores son los IDENTIFICADORES del enum de Prisma Client
// (p. ej. "PersonaNatural"), no la etiqueta con espacios que se guarda en BD.
export const clienteSchema = z.object({
  tipoCliente: z.enum(["PersonaNatural", "Empresa"]),
  identificacionFiscal: z.string().trim().min(1, "La identificación es obligatoria").max(20),
  nombreRazonSocial: z.string().trim().min(1, "La razón social es obligatoria").max(150),
  direccion: z.string().trim().min(1, "La dirección es obligatoria").max(255),
  distrito: z.string().trim().max(100).optional().or(z.literal("")),
  telefono: z.string().trim().min(1, "El teléfono es obligatorio").max(20),
  telefonoSecundario: z.string().trim().max(20).optional().or(z.literal("")),
  correo: z.string().trim().email("Correo inválido").max(100).optional().or(z.literal("")),
  correoSecundario: z.string().trim().email("Correo inválido").max(100).optional().or(z.literal("")),
  contactoNombre: z.string().trim().max(150).optional().or(z.literal("")),
  contactoCargo: z.string().trim().max(100).optional().or(z.literal("")),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
});

// --------------------------- Materiales ------------------------------
export const materialSchema = z.object({
  codigoMaterial: z.string().trim().min(1, "El código es obligatorio").max(50),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  descripcion: z.string().trim().max(255).optional().or(z.literal("")),
  categoria: z.string().trim().min(1, "La categoría es obligatoria").max(50),
  unidadMedida: z.string().trim().min(1, "La unidad es obligatoria").max(20),
  stockActual: z.coerce.number().min(0, "No puede ser negativo").default(0),
  stockMinimo: z.coerce.number().min(0, "No puede ser negativo").default(0),
  stockMaximo: z.coerce.number().min(0).optional(),
  cupp: z.coerce.number().min(0, "No puede ser negativo").default(0),
  areaAlmacen: z.string().trim().max(50).optional().or(z.literal("")),
  estanteNivel: z.string().trim().max(50).optional().or(z.literal("")),
  estado: z.enum(["Activo", "Descontinuado"]).default("Activo"),
});

// --------------------------- Movimientos inventario ------------------
export const movimientoSchema = z.object({
  idMaterial: z.coerce.number().int().positive("Seleccione un material"),
  idObra: z.coerce.number().int().positive().optional(),
  tipoMovimiento: z.enum(["Entrada", "Salida", "Ajuste"]),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  costoUnitario: z.coerce.number().min(0).default(0),
  motivo: z.string().trim().max(255).optional().or(z.literal("")),
  referenciaDocumento: z.string().trim().max(50).optional().or(z.literal("")),
});

// --------------------------- Obras -----------------------------------
export const obraSchema = z
  .object({
    idCliente: z.coerce.number().int().positive("Seleccione un cliente"),
    nombreObra: z.string().trim().min(1, "El nombre es obligatorio").max(150),
    descripcion: z.string().trim().optional().or(z.literal("")),
    tipoObra: z.string().trim().max(100).optional().or(z.literal("")),
    ubicacion: z.string().trim().max(255).optional().or(z.literal("")),
    fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
    fechaEntregaEstimada: z.string().min(1, "La fecha de entrega es obligatoria"),
    estadoObra: z
      .enum(["Presupuestando", "EnEjecucion", "Finalizado", "Cancelado"])
      .default("Presupuestando"),
  })
  .refine((d) => new Date(d.fechaEntregaEstimada) >= new Date(d.fechaInicio), {
    message: "La entrega no puede ser anterior al inicio",
    path: ["fechaEntregaEstimada"],
  });

export const avanceSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  porcentajeAvance: z.coerce.number().min(0).max(100),
  estadoObra: z.enum(["Presupuestando", "EnEjecucion", "Finalizado", "Cancelado"]),
});

// --------------------------- Presupuesto -----------------------------
export const detalleMaterialSchema = z.object({
  idMaterial: z.coerce.number().int().positive(),
  cantidadRequerida: z.coerce.number().positive(),
  precioUnitarioMomento: z.coerce.number().min(0),
});

export const presupuestoSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  costoManoObra: z.coerce.number().min(0).default(0),
  margenGananciaPorcentaje: z.coerce.number().min(0).default(0),
  detalles: z.array(detalleMaterialSchema).min(1, "Agregue al menos un material"),
});

// --------------------------- Pagos -----------------------------------
export const pagoSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  montoAbonado: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fechaPago: z.string().min(1, "La fecha es obligatoria"),
  tipoPago: z.enum(["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"]),
  observaciones: z.string().trim().max(255).optional().or(z.literal("")),
});

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
