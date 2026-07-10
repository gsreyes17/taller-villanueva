import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ROLLBACK = "__ROLLBACK__";
const results: string[] = [];
function log(name: string, ok: boolean, extra = "") {
  results.push(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
}

async function main() {
  const mat = await prisma.material.findFirst({ where: { estado: "Activo" } });
  const user = await prisma.usuario.findFirst();
  if (!mat || !user) throw new Error("Faltan datos base (material/usuario). Corre el seed primero.");
  const stock = Number(mat.stockActual);

  // --- Test 1: Salida mayor al stock debe ser RECHAZADA por el trigger ---
  let rechazada = false;
  try {
    await prisma.movimientoInventario.create({
      data: {
        idMaterial: mat.idMaterial,
        tipoMovimiento: "Salida",
        cantidad: stock + 100000,
        saldoResultante: 0,
        idUsuario: user.idUsuario,
      },
    });
  } catch (e) {
    rechazada = /Stock insuficiente/.test(String(e));
  }
  log("Kardex bloquea salida sin stock", rechazada);

  // --- Test 2: Entrada actualiza stock (rollback, no persiste) ---
  let entradaOk = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.movimientoInventario.create({
        data: {
          idMaterial: mat.idMaterial,
          tipoMovimiento: "Entrada",
          cantidad: 5,
          saldoResultante: 0,
          idUsuario: user.idUsuario,
        },
      });
      const after = await tx.material.findUnique({ where: { idMaterial: mat.idMaterial } });
      entradaOk = Number(after?.stockActual) === stock + 5;
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (!String(e).includes(ROLLBACK)) throw e;
  }
  log("Entrada suma al stock (trigger)", entradaOk, `${stock} + 5 = ${stock + 5}`);

  // --- Test 3: Mermas 6% automáticas en Presupuesto (rollback) ---
  const obra = await prisma.obra.findFirst({ where: { presupuesto: { is: null } } });
  let mermasOk = false;
  let mermasVal = "n/a";
  if (obra) {
    try {
      await prisma.$transaction(async (tx) => {
        const p = await tx.presupuesto.create({
          data: {
            idObra: obra.idObra,
            costoMaterialesBase: 1000,
            costoMermas: 0, // el trigger debe forzarlo a 60.00
            montoTotal: 0,
            fechaCreacion: new Date(),
          },
        });
        mermasVal = String(p.costoMermas);
        mermasOk = Number(p.costoMermas) === 60;
        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if (!String(e).includes(ROLLBACK)) throw e;
    }
    log("Mermas 6% automáticas en presupuesto", mermasOk, `1000 → mermas=${mermasVal} (esperado 60)`);
  } else {
    log("Mermas 6% (omitido: todas las obras ya tienen presupuesto)", true);
  }

  // --- Test 4: columna telefono existe (migración aplicada) ---
  let telOk = false;
  try {
    await prisma.usuario.findFirst({ select: { telefono: true } });
    telOk = true;
  } catch {
    telOk = false;
  }
  log("Columna Usuarios.telefono disponible", telOk);

  console.log("\n=== SMOKE TEST DE TRIGGERS / SCHEMA ===");
  results.forEach((r) => console.log(r));
  const fallos = results.filter((r) => r.startsWith("❌")).length;
  console.log(`\n${fallos === 0 ? "TODO OK ✔" : `FALLARON ${fallos}`}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
