import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});
const ROLLBACK = "__ROLLBACK__";
const out: string[] = [];
const n = (v: unknown) => Number(String(v ?? 0));
const ok = (name: string, cond: boolean, extra = "") =>
  out.push(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);

async function main() {
  const admin = await prisma.usuario.findFirst({ where: { rol: "Administrador" } });
  const plancha = await prisma.material.findUnique({ where: { codigoMaterial: "PLA-001" } });
  const perfil = await prisma.material.findUnique({ where: { codigoMaterial: "PER-001" } });
  if (!admin || !plancha || !perfil) throw new Error("Faltan datos base");

  // --- 1. Merma PONDERADA por material (plancha 12% vs perfil 6%) ---
  {
    try {
      await prisma.$transaction(async (tx) => {
        // Obra temporal para aislar la prueba (todo se revierte).
        const cli = await tx.cliente.findFirstOrThrow();
        const obra = await tx.obra.create({
          data: {
            idCliente: cli.idCliente, nombreObra: "__SMOKE__",
            fechaInicio: new Date(), fechaEntregaEstimada: new Date(Date.now() + 86400_000),
            creadoPor: admin.idUsuario,
          },
        });
        const p = await tx.presupuesto.create({
          data: { idObra: obra.idObra, costoManoObra: 0, margenGananciaPorcentaje: 0, fechaCreacion: new Date() },
        });
        // 1000 de plancha (12%) + 1000 de perfil (6%) => merma esperada 180
        await tx.detallePresupuesto.create({
          data: { idPresupuesto: p.idPresupuesto, idMaterial: plancha.idMaterial, cantidadRequerida: 10, precioUnitarioMomento: 100 },
        });
        await tx.detallePresupuesto.create({
          data: { idPresupuesto: p.idPresupuesto, idMaterial: perfil.idMaterial, cantidadRequerida: 10, precioUnitarioMomento: 100 },
        });
        const r = await tx.presupuesto.findUnique({ where: { idPresupuesto: p.idPresupuesto } });
        ok("Merma ponderada por material", n(r?.costoMermas) === 180,
          `base=${n(r?.costoMermas ? r?.costoMaterialesBase : 0)} mermas=${n(r?.costoMermas)} (esperado 180 = 12%+6%)`);
        ok("IGV 18% y total calculados", n(r?.igvMonto) === Math.round(n(r?.subtotal) * 0.18 * 100) / 100,
          `subtotal=${n(r?.subtotal)} IGV=${n(r?.igvMonto)} total=${n(r?.montoTotal)}`);
        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if (!String(e).includes(ROLLBACK)) throw e;
    }
  }

  // --- 2. Compra recibida => entrada al kardex + CUPP recalculado ---
  const stockPrev = n(perfil.stockActual);
  const cuppPrev = n(perfil.cupp);
  try {
    await prisma.$transaction(async (tx) => {
      const prov = await tx.proveedor.create({
        data: { ruc: "20999999999", razonSocial: "Proveedor Smoke S.A.C.", creadoPor: admin.idUsuario },
      });
      const compra = await tx.compra.create({
        data: {
          idProveedor: prov.idProveedor, numeroDocumento: "F001-SMOKE",
          fechaEmision: new Date(), estado: "Borrador", flete: 100, creadoPor: admin.idUsuario,
        },
      });
      // 100 unidades a 40 => subtotal 4000; flete 100 prorrateado
      await tx.detalleCompra.create({
        data: { idCompra: compra.idCompra, idMaterial: perfil.idMaterial, cantidad: 100, costoUnitario: 40, fleteProrrateado: 100 },
      });
      const c1 = await tx.compra.findUnique({ where: { idCompra: compra.idCompra } });
      ok("Totales de compra automáticos (subtotal+flete+IGV)", n(c1?.subtotal) === 4000 && n(c1?.total) === 4838,
        `subtotal=${n(c1?.subtotal)} igv=${n(c1?.igvMonto)} total=${n(c1?.total)} (esperado 4838)`);

      // Recepción => dispara kardex + CUPP
      await tx.compra.update({ where: { idCompra: compra.idCompra }, data: { estado: "Recibida", fechaRecepcion: new Date() } });
      const m = await tx.material.findUnique({ where: { idMaterial: perfil.idMaterial } });
      const mov = await tx.movimientoInventario.findFirst({
        where: { idCompra: compra.idCompra }, orderBy: { idMovimiento: "desc" },
      });
      ok("Recepción genera entrada en el kardex", !!mov && n(mov.cantidad) === 100,
        `stock ${stockPrev} -> ${n(m?.stockActual)}`);
      ok("Trazabilidad movimiento -> compra", mov?.idCompra === compra.idCompra);

      const costoReal = 40 + 100 / 100; // 41
      const esperado = Math.round(((stockPrev * cuppPrev + 100 * costoReal) / (stockPrev + 100)) * 100) / 100;
      ok("CUPP recalculado con costo real (precio+flete)", Math.abs(n(m?.cupp) - esperado) < 0.02,
        `cupp ${cuppPrev} -> ${n(m?.cupp)} (esperado ${esperado})`);
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (!String(e).includes(ROLLBACK)) throw e;
  }

  // --- 3. Vistas v2 ---
  const rent = await prisma.$queryRaw<unknown[]>`SELECT * FROM "v_rentabilidad_obras" LIMIT 1`;
  ok("Vista v_rentabilidad_obras operativa", Array.isArray(rent));
  const inv = await prisma.$queryRaw<unknown[]>`SELECT * FROM "v_inventario_ubicado" LIMIT 1`;
  ok("Vista v_inventario_ubicado operativa", Array.isArray(inv));

  console.log("\n=== SMOKE TEST MODELO v2 ===");
  out.forEach((l) => console.log(l));
  const fallos = out.filter((l) => l.startsWith("❌")).length;
  console.log(fallos === 0 ? "\nTODO OK ✔ (sin datos persistidos)\n" : `\nFALLARON ${fallos}\n`);
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
