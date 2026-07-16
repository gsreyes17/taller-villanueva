import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

/**
 * Datos DEMO para poblar el sistema con un ciclo operativo completo:
 * compras recibidas (que mueven kardex y CUPP), presupuestos, pagos,
 * consumo de material, horas-hombre y costos indirectos (junio–julio 2026).
 *
 * Idempotente: si ya se sembró, no duplica.
 */
async function main() {
  const yaExiste = await prisma.pagoObra.count({ where: { observaciones: "Pago demo" } });
  if (yaExiste > 0) {
    console.log("ℹ️  Datos demo ya presentes. Nada que hacer.");
    return;
  }

  const admin = await prisma.usuario.findFirstOrThrow({ where: { rol: "Administrador" } });
  const trabajador = await prisma.usuario.findFirst({ where: { rol: "Trabajador" } });
  const obras = await prisma.obra.findMany({ orderBy: { idObra: "asc" }, take: 2 });
  if (obras.length < 2) throw new Error("Faltan obras. Corre `npm run db:seed` primero.");
  const [o1, o2] = obras;

  const mat = async (codigo: string) =>
    prisma.material.findUniqueOrThrow({ where: { codigoMaterial: codigo } });
  const per = await mat("PER-001");
  const tub = await mat("TUB-001");
  const pla = await mat("PLA-001");
  const ang = await mat("PER-002");

  // ---------------- 1. Compras reales (mueven kardex + CUPP) -------------
  const provAcero = await prisma.proveedor.findUniqueOrThrow({ where: { ruc: "20100047218" } });
  const provSold = await prisma.proveedor.findUniqueOrThrow({ where: { ruc: "20338033137" } });

  const compras = [
    {
      prov: provAcero.idProveedor,
      doc: "F001-004521",
      emision: "2026-06-04",
      recepcion: "2026-06-05",
      flete: 180,
      items: [
        { m: per.idMaterial, cant: 60, costo: 27.8 },
        { m: ang.idMaterial, cant: 40, costo: 21.5 },
      ],
    },
    {
      prov: provAcero.idProveedor,
      doc: "F001-004698",
      emision: "2026-06-17",
      recepcion: "2026-06-18",
      flete: 150,
      items: [
        { m: tub.idMaterial, cant: 50, costo: 15.2 },
        { m: pla.idMaterial, cant: 8, costo: 279.0 },
      ],
    },
    {
      prov: provSold.idProveedor,
      doc: "F002-000912",
      emision: "2026-07-01",
      recepcion: "2026-07-02",
      flete: 40,
      items: [{ m: per.idMaterial, cant: 35, costo: 29.4 }],
    },
    {
      prov: provAcero.idProveedor,
      doc: "F001-005033",
      emision: "2026-07-06",
      recepcion: "2026-07-07",
      flete: 120,
      items: [{ m: tub.idMaterial, cant: 40, costo: 16.1 }],
    },
  ];

  for (const c of compras) {
    const importeTotal = c.items.reduce((s, i) => s + i.cant * i.costo, 0);
    const creada = await prisma.compra.create({
      data: {
        idProveedor: c.prov,
        numeroDocumento: c.doc,
        fechaEmision: new Date(c.emision),
        flete: c.flete,
        estado: "Borrador",
        creadoPor: admin.idUsuario,
        observaciones: "Compra demo",
        detalles: {
          create: c.items.map((i) => ({
            idMaterial: i.m,
            cantidad: i.cant,
            costoUnitario: i.costo,
            // Flete proporcional al importe de la línea.
            fleteProrrateado:
              Math.round(((i.cant * i.costo) / importeTotal) * c.flete * 100) / 100,
          })),
        },
      },
    });
    // Recibir dispara el trigger: entradas al kardex + recálculo del CUPP.
    await prisma.compra.update({
      where: { idCompra: creada.idCompra },
      data: { estado: "Recibida", fechaRecepcion: new Date(c.recepcion) },
    });
  }

  // ---------------- 2. Presupuestos (los totales los calcula la BD) ------
  const presupuestos = [
    {
      obra: o1.idObra,
      manoObra: 42000,
      margen: 18,
      detalles: [
        { m: per.idMaterial, cant: 850, precio: 28.5 },
        { m: pla.idMaterial, cant: 120, precio: 285.0 },
        { m: tub.idMaterial, cant: 400, precio: 15.8 },
      ],
    },
    {
      obra: o2.idObra,
      manoObra: 21000,
      margen: 15,
      detalles: [
        { m: tub.idMaterial, cant: 620, precio: 15.8 },
        { m: ang.idMaterial, cant: 180, precio: 22.4 },
      ],
    },
  ];

  for (const p of presupuestos) {
    const existe = await prisma.presupuesto.findUnique({ where: { idObra: p.obra } });
    if (existe) {
      await prisma.detallePresupuesto.deleteMany({ where: { idPresupuesto: existe.idPresupuesto } });
      await prisma.presupuesto.update({
        where: { idPresupuesto: existe.idPresupuesto },
        data: {
          costoManoObra: p.manoObra,
          margenGananciaPorcentaje: p.margen,
          detalles: {
            create: p.detalles.map((d) => ({
              idMaterial: d.m,
              cantidadRequerida: d.cant,
              precioUnitarioMomento: d.precio,
            })),
          },
        },
      });
    } else {
      await prisma.presupuesto.create({
        data: {
          idObra: p.obra,
          costoManoObra: p.manoObra,
          margenGananciaPorcentaje: p.margen,
          fechaCreacion: new Date("2026-05-20"),
          creadoPor: admin.idUsuario,
          detalles: {
            create: p.detalles.map((d) => ({
              idMaterial: d.m,
              cantidadRequerida: d.cant,
              precioUnitarioMomento: d.precio,
            })),
          },
        },
      });
    }
  }

  // ---------------- 3. Consumo de material hacia las obras ---------------
  const consumos = [
    { m: per.idMaterial, obra: o1.idObra, cant: 30, fecha: "2026-06-10" },
    { m: tub.idMaterial, obra: o2.idObra, cant: 25, fecha: "2026-06-22" },
    { m: per.idMaterial, obra: o1.idObra, cant: 20, fecha: "2026-07-04" },
    { m: ang.idMaterial, obra: o2.idObra, cant: 15, fecha: "2026-07-08" },
  ];
  for (const c of consumos) {
    const m = await prisma.material.findUniqueOrThrow({ where: { idMaterial: c.m } });
    await prisma.movimientoInventario.create({
      data: {
        idMaterial: c.m,
        idObra: c.obra,
        tipoMovimiento: "Salida",
        cantidad: c.cant,
        saldoResultante: 0, // lo recalcula el trigger
        costoUnitario: m.cupp, // se consume al costo promedio vigente
        motivo: "Consumo en obra (demo)",
        idUsuario: trabajador?.idUsuario ?? admin.idUsuario,
        fechaMovimiento: new Date(c.fecha),
      },
    });
  }

  // ---------------- 4. Mano de obra imputada -----------------------------
  const horas = [
    { obra: o1.idObra, fecha: "2026-06-11", h: 8, tarifa: 18, desc: "Corte y armado de columnas" },
    { obra: o1.idObra, fecha: "2026-06-12", h: 8, tarifa: 18, desc: "Soldadura de estructura" },
    { obra: o2.idObra, fecha: "2026-06-23", h: 6, tarifa: 20, desc: "Montaje de arcos" },
    { obra: o1.idObra, fecha: "2026-07-05", h: 7.5, tarifa: 18, desc: "Armado de vigas" },
    { obra: o2.idObra, fecha: "2026-07-09", h: 8, tarifa: 20, desc: "Instalación de cobertura" },
  ];
  for (const h of horas) {
    await prisma.manoObraObra.create({
      data: {
        idObra: h.obra,
        idUsuario: trabajador?.idUsuario ?? admin.idUsuario,
        fecha: new Date(h.fecha),
        horas: h.h,
        tarifaHora: h.tarifa,
        descripcion: h.desc,
      },
    });
  }

  // ---------------- 5. Costos indirectos ---------------------------------
  const indirectos = [
    { obra: o1.idObra, tipo: "Energia" as const, monto: 480, fecha: "2026-06-30", desc: "Consumo eléctrico junio" },
    { obra: o1.idObra, tipo: "Transporte" as const, monto: 650, fecha: "2026-07-03", desc: "Traslado de estructura a obra" },
    { obra: o2.idObra, tipo: "Equipos" as const, monto: 900, fecha: "2026-06-25", desc: "Alquiler de grúa" },
    { obra: o2.idObra, tipo: "Energia" as const, monto: 320, fecha: "2026-07-01", desc: "Consumo eléctrico julio" },
  ];
  for (const c of indirectos) {
    await prisma.costoIndirectoObra.create({
      data: {
        idObra: c.obra,
        tipo: c.tipo,
        monto: c.monto,
        fecha: new Date(c.fecha),
        descripcion: c.desc,
        registradoPor: admin.idUsuario,
      },
    });
  }

  // ---------------- 6. Pagos de clientes (ingresos) ----------------------
  const pagos = [
    { obra: o1.idObra, monto: 40000, fecha: "2026-06-12", tipo: "Transferencia" as const },
    { obra: o2.idObra, monto: 20000, fecha: "2026-06-20", tipo: "Efectivo" as const },
    { obra: o1.idObra, monto: 55000, fecha: "2026-07-03", tipo: "Transferencia" as const },
    { obra: o2.idObra, monto: 15000, fecha: "2026-07-08", tipo: "Cheque" as const },
  ];
  for (const p of pagos) {
    await prisma.pagoObra.create({
      data: {
        idObra: p.obra,
        montoAbonado: p.monto,
        fechaPago: new Date(p.fecha),
        tipoPago: p.tipo,
        observaciones: "Pago demo",
        registradoPor: admin.idUsuario,
      },
    });
  }

  console.log("✅ Datos demo sembrados (junio–julio 2026):");
  console.log(`   ${compras.length} compras recibidas · ${presupuestos.length} presupuestos`);
  console.log(`   ${consumos.length} consumos · ${horas.length} registros de mano de obra`);
  console.log(`   ${indirectos.length} costos indirectos · ${pagos.length} pagos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
