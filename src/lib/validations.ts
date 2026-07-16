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
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const materialSchema = z
  .object({
    codigoMaterial: z.string().trim().min(1, "El código es obligatorio").max(50),
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
    descripcion: opt(255),
    // Clasificación y ubicación (FK a catálogos)
    idCategoria: z.coerce.number().int().positive("Seleccione una categoría"),
    idUnidad: z.coerce.number().int().positive("Seleccione una unidad"),
    idUbicacion: z.coerce.number().int().positive().optional(),
    // Atributos técnicos
    norma: opt(50),
    espesorMm: z.coerce.number().positive("Debe ser mayor a 0").optional(),
    medidas: opt(80),
    acabado: opt(50),
    pesoUnitario: z.coerce.number().positive("Debe ser mayor a 0").optional(),
    // Stock y costos
    stockActual: z.coerce.number().min(0, "No puede ser negativo").default(0),
    stockMinimo: z.coerce.number().min(0, "No puede ser negativo").default(0),
    stockMaximo: z.coerce.number().min(0).optional(),
    cupp: z.coerce.number().min(0, "No puede ser negativo").default(0),
    porcentajeMerma: z.coerce.number().min(0).max(100, "Máximo 100%").optional(),
    estado: z.enum(["Activo", "Descontinuado"]).default("Activo"),
  })
  .refine((d) => d.stockMaximo == null || d.stockMaximo >= d.stockMinimo, {
    message: "El stock máximo no puede ser menor al mínimo",
    path: ["stockMaximo"],
  });

// --------------------------- Catálogos -------------------------------
export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  descripcion: opt(255),
  idCategoriaPadre: z.coerce.number().int().positive().optional(),
  porcentajeMerma: z.coerce.number().min(0).max(100, "Máximo 100%").default(6),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
});

export const unidadSchema = z.object({
  simbolo: z.string().trim().min(1, "El símbolo es obligatorio").max(10),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(50),
  tipo: z.enum(["Longitud", "Masa", "Area", "Volumen", "Unidad"]),
  factorBase: z.coerce.number().positive("Debe ser mayor a 0").default(1),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
});

export const ubicacionSchema = z.object({
  zona: z.string().trim().min(1, "La zona es obligatoria").max(50),
  estante: opt(50),
  nivel: opt(50),
  descripcion: opt(255),
  capacidadMax: z.coerce.number().positive("Debe ser mayor a 0").optional(),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
});

// --------------------------- Proveedores -----------------------------
export const proveedorSchema = z.object({
  ruc: z.string().trim().min(8, "RUC/DNI inválido").max(20),
  razonSocial: z.string().trim().min(1, "La razón social es obligatoria").max(150),
  direccion: opt(255),
  telefono: opt(20),
  correo: z.string().trim().email("Correo inválido").max(100).optional().or(z.literal("")),
  contactoNombre: opt(150),
  diasCredito: z.coerce.number().int().min(0, "No puede ser negativo").default(0),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
});

// --------------------------- Compras ---------------------------------
export const detalleCompraSchema = z.object({
  idMaterial: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  costoUnitario: z.coerce.number().min(0, "No puede ser negativo"),
});

export const compraSchema = z
  .object({
    idProveedor: z.coerce.number().int().positive("Seleccione un proveedor"),
    numeroDocumento: z.string().trim().min(1, "El N° de documento es obligatorio").max(50),
    fechaEmision: z.string().min(1, "La fecha de emisión es obligatoria"),
    flete: z.coerce.number().min(0, "No puede ser negativo").default(0),
    igvPorcentaje: z.coerce.number().min(0).max(100).default(18),
    observaciones: opt(255),
    detalles: z
      .array(detalleCompraSchema)
      .min(1, "Agregue al menos un material")
      .refine((rows) => new Set(rows.map((r) => r.idMaterial)).size === rows.length, {
        message: "Hay un material repetido en el detalle. Únelo en una sola fila.",
      }),
  });

// --------------------------- Costeo de obra --------------------------
export const manoObraSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  idUsuario: z.coerce.number().int().positive().optional(),
  descripcion: opt(255),
  fecha: z.string().min(1, "La fecha es obligatoria"),
  horas: z.coerce.number().positive("Debe ser mayor a 0").max(24, "Máximo 24 horas por registro"),
  tarifaHora: z.coerce.number().min(0, "No puede ser negativo"),
});

export const costoIndirectoSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  tipo: z.enum(["Energia", "Transporte", "Equipos", "Consumibles", "Subcontrato", "Otro"]),
  descripcion: opt(255),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fecha: z.string().min(1, "La fecha es obligatoria"),
});

// --------------------------- Filtros de reportes ---------------------
export const filtroReporteSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  idCliente: z.coerce.number().int().positive().optional(),
  idObra: z.coerce.number().int().positive().optional(),
  idProveedor: z.coerce.number().int().positive().optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  idUbicacion: z.coerce.number().int().positive().optional(),
  estadoObra: z.enum(["Presupuestando", "EnEjecucion", "Finalizado", "Cancelado"]).optional(),
  soloBajoStock: z.coerce.boolean().optional(),
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
  margenGananciaPorcentaje: z.coerce.number().min(0).max(1000, "Margen fuera de rango").default(0),
  igvPorcentaje: z.coerce.number().min(0).max(100).default(18),
  detalles: z
    .array(detalleMaterialSchema)
    .min(1, "Agregue al menos un material")
    .refine(
      (rows) => new Set(rows.map((r) => r.idMaterial)).size === rows.length,
      { message: "Hay un material repetido en el detalle. Únelo en una sola fila." },
    ),
});

// --------------------------- Pagos -----------------------------------
export const pagoSchema = z.object({
  idObra: z.coerce.number().int().positive(),
  montoAbonado: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fechaPago: z.string().min(1, "La fecha es obligatoria"),
  tipoPago: z.enum(["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"]),
  observaciones: z.string().trim().max(255).optional().or(z.literal("")),
});

// --------------------------- Perfil (autogestión) --------------------
export const perfilSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(50),
    apellido: z.string().trim().min(1, "El apellido es obligatorio").max(50),
    correo: z.string().trim().email("Correo inválido").max(100).optional().or(z.literal("")),
    telefono: z.string().trim().max(20).optional().or(z.literal("")),
    contrasenaActual: z.string().optional().or(z.literal("")),
    contrasenaNueva: z.string().optional().or(z.literal("")),
    confirmarContrasena: z.string().optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    const quiereCambiar = Boolean(d.contrasenaNueva || d.confirmarContrasena || d.contrasenaActual);
    if (!quiereCambiar) return;
    if (!d.contrasenaActual) {
      ctx.addIssue({ code: "custom", path: ["contrasenaActual"], message: "Ingrese su contraseña actual" });
    }
    if (!d.contrasenaNueva || d.contrasenaNueva.length < 6) {
      ctx.addIssue({ code: "custom", path: ["contrasenaNueva"], message: "Mínimo 6 caracteres" });
    }
    if (d.contrasenaNueva !== d.confirmarContrasena) {
      ctx.addIssue({ code: "custom", path: ["confirmarContrasena"], message: "Las contraseñas no coinciden" });
    }
  });

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
