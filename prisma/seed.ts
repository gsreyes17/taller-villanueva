import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Seed base del sistema.
 * Los catálogos (categorías, unidades, ubicaciones) los crea la migración v2;
 * aquí se siembran usuarios, clientes, proveedores y materiales reales del rubro.
 */
async function main() {
  console.log("🌱 Sembrando datos base de Taller Villanueva...");

  // --------------------------- Usuarios ---------------------------
  const admin = await prisma.usuario.upsert({
    where: { nombreUsuario: "lvillanueva" },
    update: {},
    create: {
      nombreUsuario: "lvillanueva",
      nombre: "Luis Orlando",
      apellido: "Villanueva Rosales",
      correo: "lvillanueva@tallervillanueva.pe",
      telefono: "987654321",
      contrasenaHash: await bcrypt.hash("admin123", 10),
      rol: "Administrador",
    },
  });

  await prisma.usuario.upsert({
    where: { nombreUsuario: "mtorres" },
    update: {},
    create: {
      nombreUsuario: "mtorres",
      nombre: "María",
      apellido: "Torres López",
      contrasenaHash: await bcrypt.hash("empleado123", 10),
      rol: "Trabajador",
    },
  });

  // --------------------------- Clientes ---------------------------
  const cliente1 = await prisma.cliente.upsert({
    where: { identificacionFiscal: "20567891234" },
    update: {},
    create: {
      tipoCliente: "Empresa",
      identificacionFiscal: "20567891234",
      nombreRazonSocial: "Constructora Los Andes S.A.C.",
      direccion: "Av. Los Constructores 123",
      distrito: "Ate",
      telefono: "01-3456789",
      correo: "contacto@losandes.com",
      contactoNombre: "Ing. Ricardo Paredes",
      contactoCargo: "Gerente de Proyectos",
      creadoPor: admin.idUsuario,
    },
  });

  const cliente2 = await prisma.cliente.upsert({
    where: { identificacionFiscal: "20123456789" },
    update: {},
    create: {
      tipoCliente: "Empresa",
      identificacionFiscal: "20123456789",
      nombreRazonSocial: "Inmobiliaria Del Sur E.I.R.L.",
      direccion: "Jr. San Martín 456",
      distrito: "San Isidro",
      telefono: "01-2345678",
      correo: "ventas@delsur.pe",
      creadoPor: admin.idUsuario,
    },
  });

  await prisma.cliente.upsert({
    where: { identificacionFiscal: "10456789123" },
    update: {},
    create: {
      tipoCliente: "PersonaNatural",
      identificacionFiscal: "10456789123",
      nombreRazonSocial: "García Medina, Jorge Luis",
      direccion: "Calle Las Begonias 780",
      distrito: "Surco",
      telefono: "987654321",
      correo: "jgarcia@email.com",
      creadoPor: admin.idUsuario,
    },
  });

  // --------------------------- Proveedores ------------------------
  const provAcero = await prisma.proveedor.upsert({
    where: { ruc: "20100047218" },
    update: {},
    create: {
      ruc: "20100047218",
      razonSocial: "Aceros Arequipa S.A.",
      direccion: "Av. Argentina 2450, Callao",
      telefono: "01-5170300",
      correo: "ventas@acerosarequipa.com",
      contactoNombre: "Área Comercial",
      diasCredito: 30,
      creadoPor: admin.idUsuario,
    },
  });

  await prisma.proveedor.upsert({
    where: { ruc: "20338033137" },
    update: {},
    create: {
      ruc: "20338033137",
      razonSocial: "Soldaduras del Perú S.A.C.",
      direccion: "Av. Colonial 1850, Lima",
      telefono: "01-3364455",
      correo: "pedidos@soldaperu.pe",
      contactoNombre: "Carlos Ríos",
      diasCredito: 15,
      creadoPor: admin.idUsuario,
    },
  });

  await prisma.proveedor.upsert({
    where: { ruc: "20512333444" },
    update: {},
    create: {
      ruc: "20512333444",
      razonSocial: "Ferretería Industrial Lima S.R.L.",
      direccion: "Av. Nicolás Arriola 900, La Victoria",
      telefono: "01-4711234",
      diasCredito: 0, // contado
      creadoPor: admin.idUsuario,
    },
  });

  // --------------------------- Materiales -------------------------
  // Helpers para resolver los catálogos creados por la migración.
  const cat = async (nombre: string) =>
    (await prisma.categoria.findFirstOrThrow({ where: { nombre } })).idCategoria;
  const uni = async (simbolo: string) =>
    (await prisma.unidadMedida.findUniqueOrThrow({ where: { simbolo } })).idUnidad;
  const ubi = async (zona: string, estante?: string) =>
    (await prisma.ubicacion.findFirstOrThrow({ where: { zona, ...(estante ? { estante } : {}) } }))
      .idUbicacion;

  const materiales = [
    {
      codigoMaterial: "PER-001",
      nombre: 'Perfil C 6"x2" x 3mm',
      descripcion: "Perfil estructural tipo C, plegado en frío",
      idCategoria: await cat("Perfiles"),
      idUnidad: await uni("m"),
      idUbicacion: await ubi("Zona A", "Rack 1"),
      norma: "ASTM A36",
      medidas: '6" x 2"',
      espesorMm: 3,
      acabado: "Negro",
      pesoUnitario: 6.71, // kg/m
      stockActual: 45,
      stockMinimo: 30,
      stockMaximo: 200,
      cupp: 28.5,
    },
    {
      codigoMaterial: "PLA-001",
      nombre: "Plancha LAC 1/8\" x 4'x8'",
      descripcion: "Plancha de acero laminado en caliente",
      idCategoria: await cat("Planchas"),
      idUnidad: await uni("pln"),
      idUbicacion: await ubi("Zona B", "Caballete 1"),
      norma: "ASTM A36",
      medidas: "4' x 8'",
      espesorMm: 3.17,
      acabado: "Negro",
      pesoUnitario: 29.6, // kg/plancha
      stockActual: 12,
      stockMinimo: 20,
      stockMaximo: 80,
      cupp: 285.0,
    },
    {
      codigoMaterial: "TUB-001",
      nombre: 'Tubo Cuadrado 2"x2" x 2mm',
      descripcion: "Tubo estructural cuadrado LAF",
      idCategoria: await cat("Tubos"),
      idUnidad: await uni("m"),
      idUbicacion: await ubi("Zona A", "Rack 2"),
      norma: "ASTM A500",
      medidas: '2" x 2"',
      espesorMm: 2,
      acabado: "Negro",
      pesoUnitario: 3.05,
      stockActual: 28,
      stockMinimo: 25,
      stockMaximo: 150,
      cupp: 15.8,
    },
    {
      codigoMaterial: "SOL-001",
      nombre: 'Electrodo E6011 1/8"',
      descripcion: "Electrodo celulósico para acero al carbono",
      idCategoria: await cat("Soldadura"),
      idUnidad: await uni("kg"),
      idUbicacion: await ubi("Zona C", "Anaquel 1"),
      norma: "AWS E6011",
      medidas: '1/8"',
      stockActual: 8,
      stockMinimo: 15,
      stockMaximo: 60,
      cupp: 18.5,
    },
    {
      codigoMaterial: "PER-002",
      nombre: 'Ángulo L 2"x2" x 1/4"',
      descripcion: "Ángulo estructural de alas iguales",
      idCategoria: await cat("Perfiles"),
      idUnidad: await uni("m"),
      idUbicacion: await ubi("Zona A", "Rack 1"),
      norma: "ASTM A36",
      medidas: '2" x 2"',
      espesorMm: 6.35,
      acabado: "Negro",
      pesoUnitario: 4.75,
      stockActual: 60,
      stockMinimo: 24,
      stockMaximo: 180,
      cupp: 22.4,
    },
    {
      codigoMaterial: "TUB-002",
      nombre: 'Tubo Redondo Ø 2" x 2mm',
      descripcion: "Tubo estructural redondo",
      idCategoria: await cat("Tubos"),
      idUnidad: await uni("m"),
      idUbicacion: await ubi("Zona A", "Rack 2"),
      norma: "ASTM A53",
      medidas: 'Ø 2"',
      espesorMm: 2,
      acabado: "Galvanizado",
      pesoUnitario: 2.93,
      stockActual: 36,
      stockMinimo: 20,
      cupp: 19.9,
    },
    {
      codigoMaterial: "ABR-001",
      nombre: 'Disco de corte 7" x 1/8"',
      descripcion: "Disco abrasivo para corte de metal",
      idCategoria: await cat("Abrasivos"),
      idUnidad: await uni("und"),
      idUbicacion: await ubi("Zona C", "Anaquel 1"),
      medidas: '7"',
      stockActual: 40,
      stockMinimo: 20,
      cupp: 6.5,
    },
    {
      codigoMaterial: "FIJ-001",
      nombre: "Perno hexagonal 1/2\" x 2\" G5",
      descripcion: "Perno grado 5 con tuerca y arandela",
      idCategoria: await cat("Pernería"),
      idUnidad: await uni("und"),
      idUbicacion: await ubi("Zona C", "Anaquel 2"),
      norma: "ASTM A325",
      medidas: '1/2" x 2"',
      acabado: "Galvanizado",
      stockActual: 250,
      stockMinimo: 100,
      cupp: 1.8,
    },
    {
      codigoMaterial: "PIN-001",
      nombre: "Base anticorrosiva gris",
      descripcion: "Pintura base epóxica para estructura metálica",
      idCategoria: await cat("Pinturas"),
      idUnidad: await uni("gal"),
      idUbicacion: await ubi("Zona D", "Gabinete 1"),
      acabado: "Mate",
      stockActual: 6,
      stockMinimo: 8,
      cupp: 62.0,
    },
  ];

  for (const m of materiales) {
    await prisma.material.upsert({
      where: { codigoMaterial: m.codigoMaterial },
      update: {},
      create: m,
    });
  }

  // --------------------------- Obras ------------------------------
  await prisma.obra.upsert({
    where: { idObra: 1 },
    update: {},
    create: {
      idCliente: cliente1.idCliente,
      nombreObra: "Nave Industrial - Proyecto Norte",
      descripcion: "Estructura metálica para nave industrial de 800 m²",
      tipoObra: "Nave Industrial",
      ubicacion: "Av. Industrial 500, Lurín",
      fechaInicio: new Date("2026-05-15"),
      fechaEntregaEstimada: new Date("2026-08-15"),
      porcentajeAvance: 35,
      estadoObra: "EnEjecucion",
      creadoPor: admin.idUsuario,
    },
  });

  await prisma.obra.upsert({
    where: { idObra: 2 },
    update: {},
    create: {
      idCliente: cliente2.idCliente,
      nombreObra: "Techo Parabólico - Almacén Central",
      descripcion: "Cobertura metálica curva de 400 m²",
      tipoObra: "Techo Parabólico",
      ubicacion: "Jr. Los Álamos 220, Ate",
      fechaInicio: new Date("2026-04-20"),
      fechaEntregaEstimada: new Date("2026-07-20"),
      porcentajeAvance: 75,
      estadoObra: "EnEjecucion",
      creadoPor: admin.idUsuario,
    },
  });

  console.log(`✅ Base sembrada: ${materiales.length} materiales, 3 clientes, 3 proveedores, 2 obras.`);
  console.log("   Admin: lvillanueva / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
