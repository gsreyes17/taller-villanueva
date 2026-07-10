import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Datos DEMO para poblar el dashboard (balance junio–julio 2026).
// Idempotente: si ya se sembró, no duplica. Marcadores: pagos con
// observaciones "Pago demo" y compras con referencia "DEMO".
async function main() {
  const yaExiste = await prisma.pagoObra.count({ where: { observaciones: "Pago demo" } });
  if (yaExiste > 0) {
    console.log("ℹ️  Datos demo ya presentes. Nada que hacer.");
    return;
  }

  const admin = await prisma.usuario.findFirst({ where: { rol: "Administrador" } });
  const obras = await prisma.obra.findMany({ orderBy: { idObra: "asc" }, take: 2 });
  if (!admin || obras.length < 2) {
    throw new Error("Faltan usuario admin u obras. Corre `npm run db:seed` primero.");
  }
  const [o1, o2] = obras;

  // 1. Presupuestos (para que 'Valor en Obras' y saldos muestren números)
  for (const [obra, monto] of [
    [o1, 185000],
    [o2, 95000],
  ] as const) {
    const ex = await prisma.presupuesto.findUnique({ where: { idObra: obra.idObra } });
    if (!ex) {
      await prisma.presupuesto.create({
        data: {
          idObra: obra.idObra,
          costoManoObra: Math.round(monto * 0.25),
          costoMaterialesBase: Math.round(monto * 0.5),
          margenGananciaPorcentaje: 15,
          montoTotal: monto,
          fechaCreacion: new Date("2026-05-20"),
          creadoPor: admin.idUsuario,
        },
      });
    }
  }

  // 2. Pagos (ingresos) junio y julio
  const pagos = [
    { idObra: o1.idObra, monto: 40000, fecha: "2026-06-12", tipo: "Transferencia" as const },
    { idObra: o2.idObra, monto: 20000, fecha: "2026-06-20", tipo: "Efectivo" as const },
    { idObra: o1.idObra, monto: 55000, fecha: "2026-07-03", tipo: "Transferencia" as const },
    { idObra: o2.idObra, monto: 15000, fecha: "2026-07-08", tipo: "Cheque" as const },
  ];
  for (const p of pagos) {
    await prisma.pagoObra.create({
      data: {
        idObra: p.idObra,
        montoAbonado: p.monto,
        fechaPago: new Date(p.fecha),
        tipoPago: p.tipo,
        observaciones: "Pago demo",
        registradoPor: admin.idUsuario,
      },
    });
  }

  // 3. Compras (egresos = entradas de inventario) junio y julio.
  //    Se aplican a materiales 'Normales' para no alterar las alertas de bajo stock.
  const per = await prisma.material.findUnique({ where: { codigoMaterial: "PER-001" } });
  const tub = await prisma.material.findUnique({ where: { codigoMaterial: "TUB-001" } });
  const compras = [
    { mat: per, qty: 50, costo: 28.5, fecha: "2026-06-05" },
    { mat: tub, qty: 40, costo: 15.8, fecha: "2026-06-18" },
    { mat: per, qty: 30, costo: 29.0, fecha: "2026-07-02" },
    { mat: tub, qty: 35, costo: 16.0, fecha: "2026-07-06" },
  ];
  for (const c of compras) {
    if (!c.mat) continue;
    await prisma.movimientoInventario.create({
      data: {
        idMaterial: c.mat.idMaterial,
        tipoMovimiento: "Entrada",
        cantidad: c.qty,
        saldoResultante: 0, // el trigger lo recalcula
        costoUnitario: c.costo,
        motivo: "Compra demo",
        referenciaDocumento: "DEMO",
        idUsuario: admin.idUsuario,
        fechaMovimiento: new Date(c.fecha),
      },
    });
  }

  console.log("✅ Datos demo sembrados (presupuestos + pagos + compras junio/julio 2026).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
