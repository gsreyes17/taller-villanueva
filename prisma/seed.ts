import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Sembrando datos de Taller Villanueva...");

  // --- Usuario administrador (coincide con el prototipo) ---
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.usuario.upsert({
    where: { nombreUsuario: "lvillanueva" },
    update: {},
    create: {
      nombreUsuario: "lvillanueva",
      nombre: "Luis Orlando",
      apellido: "Villanueva Rosales",
      correo: "lvillanueva@tallervillanueva.pe",
      contrasenaHash: adminHash,
      rol: "Administrador",
      estado: "Activo",
    },
  });

  const empleadoHash = await bcrypt.hash("empleado123", 10);
  await prisma.usuario.upsert({
    where: { nombreUsuario: "mtorres" },
    update: {},
    create: {
      nombreUsuario: "mtorres",
      nombre: "María",
      apellido: "Torres López",
      contrasenaHash: empleadoHash,
      rol: "Trabajador",
      estado: "Activo",
    },
  });

  // --- Clientes ---
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

  // --- Materiales ---
  const materiales = [
    { codigoMaterial: "PER-001", nombre: 'Perfil C 6"x2" x 3mm', descripcion: "Perfil estructural tipo C de 6 pulgadas", categoria: "Perfiles", unidadMedida: "Metro", stockActual: 45, stockMinimo: 30, cupp: 28.5 },
    { codigoMaterial: "PLA-001", nombre: "Plancha LAC 1/8\" x 4'x8'", descripcion: "Plancha de acero laminado en caliente", categoria: "Planchas", unidadMedida: "Unidad", stockActual: 12, stockMinimo: 20, cupp: 285.0 },
    { codigoMaterial: "SOL-001", nombre: 'Electrodo E6011 1/8"', descripcion: "Electrodo para soldadura", categoria: "Soldadura", unidadMedida: "Kg", stockActual: 8, stockMinimo: 15, cupp: 18.5 },
    { codigoMaterial: "TUB-001", nombre: 'Tubo Cuadrado 2" x 2" x 2mm', descripcion: "Tubo estructural cuadrado", categoria: "Tubos", unidadMedida: "Metro", stockActual: 28, stockMinimo: 25, cupp: 15.8 },
  ];
  for (const m of materiales) {
    await prisma.material.upsert({
      where: { codigoMaterial: m.codigoMaterial },
      update: {},
      create: m,
    });
  }

  // --- Obras ---
  await prisma.obra.upsert({
    where: { idObra: 1 },
    update: {},
    create: {
      idCliente: cliente1.idCliente,
      nombreObra: "Nave Industrial - Proyecto Norte",
      descripcion: "Estructura metálica para nave industrial",
      tipoObra: "Nave Industrial",
      fechaInicio: new Date("2025-10-15"),
      fechaEntregaEstimada: new Date("2026-01-15"),
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
      tipoObra: "Techo Parabólico",
      fechaInicio: new Date("2025-09-20"),
      fechaEntregaEstimada: new Date("2025-12-20"),
      porcentajeAvance: 75,
      estadoObra: "EnEjecucion",
      creadoPor: admin.idUsuario,
    },
  });

  console.log("✅ Datos sembrados. Usuario admin: lvillanueva / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
