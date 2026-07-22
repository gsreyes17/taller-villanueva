import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

/**
 * Genera 6 meses de operación (feb–jul 2026) de un taller de metalmecánica
 * pequeño, calibrado para una utilidad de ~S/5,000/mes.
 *
 * MODELO ECONÓMICO (por mes, valores SIN IGV):
 *   Ingresos por obras facturadas ....... ~S/ 19,000
 *   (−) Materiales consumidos ........... ~S/  6,000
 *   (−) Mano de obra (2 operarios) ...... ~S/  5,200
 *   (−) Costos indirectos (luz, flete…) . ~S/  2,300
 *   (−) Gastos fijos implícitos ......... (no modelados: local, admin)
 *   = Utilidad operativa ................ ~S/  5,000
 *
 * Determinista: sin Math.random, para que el resultado sea reproducible
 * y auditable. Idempotente por el marcador "OP-2026" en las obras.
 */

// --------------------------- Catálogo de trabajos típicos ---------------------------
// Cada plantilla define el trabajo, su precio de venta SIN IGV y sus insumos.
type Plantilla = {
  tipo: string;
  nombre: string;
  precio: number; // venta sin IGV
  manoObraH: number; // horas-hombre
  materiales: { cod: string; cant: number }[];
};

const PLANTILLAS: Plantilla[] = [
  {
    tipo: "Reja metálica",
    nombre: "Reja de seguridad para ventana",
    precio: 1150,
    manoObraH: 10,
    materiales: [
      { cod: "TUB-003", cant: 24 },
      { cod: "BAR-002", cant: 18 },
      { cod: "SOL-001", cant: 1.5 },
      { cod: "ABR-002", cant: 3 },
      { cod: "PIN-001", cant: 0.4 },
      { cod: "PIN-002", cant: 0.4 },
    ],
  },
  {
    tipo: "Puerta metálica",
    nombre: "Puerta batiente de ingreso",
    precio: 1750,
    manoObraH: 14,
    materiales: [
      { cod: "TUB-004", cant: 16 },
      { cod: "PLA-002", cant: 1.5 },
      { cod: "PER-003", cant: 8 },
      { cod: "HRJ-001", cant: 3 },
      { cod: "HRJ-003", cant: 1 },
      { cod: "SOL-001", cant: 2 },
      { cod: "ABR-002", cant: 4 },
      { cod: "PIN-001", cant: 0.5 },
      { cod: "PIN-002", cant: 0.5 },
    ],
  },
  {
    tipo: "Portón corredizo",
    nombre: "Portón corredizo vehicular",
    precio: 3850,
    manoObraH: 26,
    materiales: [
      { cod: "TUB-001", cant: 22 },
      { cod: "TUB-003", cant: 30 },
      { cod: "PLA-004", cant: 3 },
      { cod: "HRJ-004", cant: 4 },
      { cod: "HRJ-005", cant: 2 },
      { cod: "SOL-001", cant: 4 },
      { cod: "ABR-001", cant: 4 },
      { cod: "ABR-003", cant: 2 },
      { cod: "PIN-001", cant: 1 },
      { cod: "PIN-002", cant: 1 },
    ],
  },
  {
    tipo: "Escalera metálica",
    nombre: "Escalera recta con pasamanos",
    precio: 3200,
    manoObraH: 22,
    materiales: [
      { cod: "PER-001", cant: 12 },
      { cod: "PLA-003", cant: 2 },
      { cod: "TUB-005", cant: 14 },
      { cod: "PER-002", cant: 10 },
      { cod: "SOL-002", cant: 3 },
      { cod: "ABR-001", cant: 3 },
      { cod: "ANC-001", cant: 8 },
      { cod: "PIN-001", cant: 0.8 },
      { cod: "PIN-002", cant: 0.8 },
    ],
  },
  {
    tipo: "Baranda",
    nombre: "Baranda de protección para escalera",
    precio: 1390,
    manoObraH: 11,
    materiales: [
      { cod: "TUB-005", cant: 18 },
      { cod: "TUB-003", cant: 12 },
      { cod: "PER-005", cant: 6 },
      { cod: "SOL-001", cant: 1.5 },
      { cod: "ABR-002", cant: 3 },
      { cod: "PIN-001", cant: 0.4 },
      { cod: "PIN-002", cant: 0.4 },
    ],
  },
  {
    tipo: "Estructura de techo",
    nombre: "Estructura metálica para cobertura",
    precio: 6900,
    manoObraH: 42,
    materiales: [
      { cod: "PER-001", cant: 38 },
      { cod: "PER-002", cant: 26 },
      { cod: "TUB-006", cant: 12 },
      { cod: "PLA-001", cant: 2 },
      { cod: "FIJ-001", cant: 40 },
      { cod: "SOL-002", cant: 6 },
      { cod: "ABR-001", cant: 6 },
      { cod: "ABR-003", cant: 3 },
      { cod: "PIN-001", cant: 1.6 },
      { cod: "PIN-002", cant: 1.4 },
    ],
  },
  {
    tipo: "Mesa de trabajo",
    nombre: "Mesa de trabajo industrial",
    precio: 1060,
    manoObraH: 8,
    materiales: [
      { cod: "PER-002", cant: 10 },
      { cod: "PLA-001", cant: 1 },
      { cod: "SOL-001", cant: 1.2 },
      { cod: "ABR-002", cant: 2 },
      { cod: "PIN-001", cant: 0.3 },
      { cod: "PIN-002", cant: 0.3 },
    ],
  },
  {
    tipo: "Estante metálico",
    nombre: "Estantería metálica de almacén",
    precio: 1500,
    manoObraH: 12,
    materiales: [
      { cod: "PER-003", cant: 28 },
      { cod: "PLA-002", cant: 2 },
      { cod: "SOL-003", cant: 2 },
      { cod: "ABR-002", cant: 3 },
      { cod: "PIN-001", cant: 0.5 },
      { cod: "PIN-002", cant: 0.4 },
    ],
  },
  {
    tipo: "Reja ornamental",
    nombre: "Reja ornamental para jardín",
    precio: 2100,
    manoObraH: 16,
    materiales: [
      { cod: "TUB-003", cant: 20 },
      { cod: "BAR-002", cant: 26 },
      { cod: "ORN-001", cant: 12 },
      { cod: "ORN-002", cant: 8 },
      { cod: "SOL-001", cant: 2 },
      { cod: "ABR-002", cant: 3 },
      { cod: "PIN-001", cant: 0.5 },
      { cod: "PIN-002", cant: 0.5 },
    ],
  },
  {
    tipo: "Pasamanos inoxidable",
    nombre: "Pasamanos de acero inoxidable",
    precio: 2520,
    manoObraH: 14,
    materiales: [
      { cod: "INX-001", cant: 12 },
      { cod: "SOL-005", cant: 0.8 },
      { cod: "ABR-004", cant: 4 },
      { cod: "ANC-002", cant: 6 },
    ],
  },
];

// Programa mensual: qué trabajos se hacen cada mes (índices de PLANTILLAS).
// ~7 obras/mes → ingresos ~S/19k/mes.
const PROGRAMA: { mes: number; anio: number; trabajos: number[] }[] = [
  { mes: 1, anio: 2026, trabajos: [0, 1, 4, 6, 8, 2, 7] },        // feb
  { mes: 2, anio: 2026, trabajos: [0, 3, 1, 5, 6, 4] },            // mar
  { mes: 3, anio: 2026, trabajos: [2, 0, 1, 7, 4, 8, 6] },         // abr
  { mes: 4, anio: 2026, trabajos: [5, 0, 1, 3, 6, 4] },            // may
  { mes: 5, anio: 2026, trabajos: [0, 2, 1, 9, 4, 7, 6] },         // jun
  { mes: 6, anio: 2026, trabajos: [3, 0, 1, 5, 4] },               // jul (mes en curso)
];

const CLIENTES_RUC = ["20567891234", "20123456789", "10456789123"];
const TARIFA_HORA = 18; // S/ por hora-hombre

const INDIRECTOS_MES = [
  { tipo: "Energia" as const, monto: 620, desc: "Consumo eléctrico del taller" },
  { tipo: "Transporte" as const, monto: 480, desc: "Traslado e instalación en obra" },
  { tipo: "Equipos" as const, monto: 180, desc: "Mantenimiento de equipos" },
  { tipo: "Consumibles" as const, monto: 140, desc: "Consumibles menores de taller" },
];

const fecha = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d, 12));

async function main() {
  console.log("🌱 Generando 6 meses de operación (feb–jul 2026)...");

  const marcador = await prisma.obra.count({ where: { descripcion: { contains: "OP-2026" } } });
  if (marcador > 0) {
    console.log("ℹ️  La operación ya fue generada. Nada que hacer.");
    return;
  }

  const admin = await prisma.usuario.findFirstOrThrow({ where: { rol: "Administrador" } });
  const operario = await prisma.usuario.findFirst({ where: { rol: "Trabajador" } });
  const idOperario = operario?.idUsuario ?? admin.idUsuario;
  const clientes = await prisma.cliente.findMany({
    where: { identificacionFiscal: { in: CLIENTES_RUC } },
    orderBy: { idCliente: "asc" },
  });
  const provAcero = await prisma.proveedor.findUniqueOrThrow({ where: { ruc: "20100047218" } });
  const provSold = await prisma.proveedor.findUniqueOrThrow({ where: { ruc: "20338033137" } });
  const provFerr = await prisma.proveedor.findUniqueOrThrow({ where: { ruc: "20512333444" } });

  const mats = await prisma.material.findMany();
  const byCod = new Map(mats.map((m) => [m.codigoMaterial, m]));
  const cupp = (cod: string) => Number(String(byCod.get(cod)?.cupp ?? 0));

  let nObras = 0;
  let nCompras = 0;
  let doc = 5100;

  for (const [i, plan] of PROGRAMA.entries()) {
    const { mes, anio } = plan;
    const esMesActual = i === PROGRAMA.length - 1;

    // ---------- 1. COMPRAS del mes (reponer lo que se va a consumir) ----------
    // Se compra a inicio de mes: acero, consumibles y ferretería.
    const necesidad = new Map<string, number>();
    for (const idx of plan.trabajos) {
      for (const m of PLANTILLAS[idx].materiales) {
        necesidad.set(m.cod, (necesidad.get(m.cod) ?? 0) + m.cant);
      }
    }
    // Se compra ~120% de lo que se consumirá (colchón de stock).
    const compraItems = [...necesidad.entries()].map(([cod, cant]) => ({
      cod,
      cant: Math.ceil(cant * 1.2),
    }));

    const grupos: { prov: number; filtro: (c: string) => boolean; flete: number }[] = [
      { prov: provAcero.idProveedor, filtro: (c) => /^(PER|TUB|PLA|BAR|MAL|INX)/.test(c), flete: 90 },
      { prov: provSold.idProveedor, filtro: (c) => /^(SOL|ABR|GAS)/.test(c), flete: 25 },
      { prov: provFerr.idProveedor, filtro: (c) => /^(FIJ|TOR|ANC|PIN|SLV|HRJ|ORN|BRO)/.test(c), flete: 20 },
    ];

    for (const g of grupos) {
      const items = compraItems.filter((it) => g.filtro(it.cod) && byCod.has(it.cod));
      if (items.length === 0) continue;
      // Precio de compra: el CUPP vigente con una ligera variación por mes (mercado).
      const factor = 1 + (i - 2) * 0.008; // ±2% a lo largo del semestre
      const detalle = items.map((it) => ({
        idMaterial: byCod.get(it.cod)!.idMaterial,
        cantidad: it.cant,
        costoUnitario: Math.round(cupp(it.cod) * factor * 100) / 100,
      }));
      const importe = detalle.reduce((s, d) => s + d.cantidad * d.costoUnitario, 0);

      const compra = await prisma.compra.create({
        data: {
          idProveedor: g.prov,
          numeroDocumento: `F001-${doc++}`,
          fechaEmision: fecha(anio, mes, 2),
          flete: g.flete,
          estado: "Borrador",
          creadoPor: admin.idUsuario,
          observaciones: "Reposición mensual de stock",
          detalles: {
            create: detalle.map((d) => ({
              ...d,
              fleteProrrateado:
                Math.round(((d.cantidad * d.costoUnitario) / importe) * g.flete * 100) / 100,
            })),
          },
        },
      });
      // Recibir dispara: entradas al kardex + recálculo del CUPP.
      await prisma.compra.update({
        where: { idCompra: compra.idCompra },
        data: { estado: "Recibida", fechaRecepcion: fecha(anio, mes, 3) },
      });
      nCompras++;
    }

    // ---------- 2. OBRAS del mes ----------
    for (const [j, idx] of plan.trabajos.entries()) {
      const p = PLANTILLAS[idx];
      const cliente = clientes[(i + j) % clientes.length];
      const diaInicio = 4 + j * 3;
      const diaFin = Math.min(diaInicio + 6, 27);

      // La última obra del mes en curso queda "Presupuestando" (sin ejecutar).
      const ultimaDelMesActual = esMesActual && j === plan.trabajos.length - 1;
      const estado = ultimaDelMesActual
        ? ("Presupuestando" as const)
        : esMesActual && j >= plan.trabajos.length - 2
          ? ("EnEjecucion" as const)
          : ("Finalizado" as const);

      const obra = await prisma.obra.create({
        data: {
          idCliente: cliente.idCliente,
          nombreObra: `${p.nombre} — ${cliente.nombreRazonSocial.split(" ")[0]}`,
          descripcion: `${p.tipo}. Trabajo estándar de taller. [OP-2026]`,
          tipoObra: p.tipo,
          ubicacion: cliente.direccion,
          fechaInicio: fecha(anio, mes, diaInicio),
          fechaEntregaEstimada: fecha(anio, mes, diaFin),
          fechaEntregaReal: estado === "Finalizado" ? fecha(anio, mes, diaFin) : null,
          porcentajeAvance: estado === "Finalizado" ? 100 : estado === "EnEjecucion" ? 60 : 0,
          estadoObra: estado,
          creadoPor: admin.idUsuario,
        },
      });
      nObras++;

      // ---------- 3. PRESUPUESTO (la BD calcula mermas + IGV) ----------
      // El precio de venta se alcanza vía el margen sobre el costo estimado.
      // La merma real es ponderada por material (~9-12%), no un 6% plano: se
      // usa 1.10 como aproximación para no subestimar el precio de venta.
      const costoMat = p.materiales.reduce((s, m) => s + m.cant * cupp(m.cod), 0);
      const costoMO = p.manoObraH * TARIFA_HORA;
      const baseAprox = costoMat * 1.1 + costoMO;
      const margen = Math.max(5, Math.round(((p.precio / baseAprox - 1) * 100) * 10) / 10);

      await prisma.presupuesto.create({
        data: {
          idObra: obra.idObra,
          costoManoObra: costoMO,
          margenGananciaPorcentaje: margen,
          fechaCreacion: fecha(anio, mes, Math.max(1, diaInicio - 2)),
          creadoPor: admin.idUsuario,
          detalles: {
            create: p.materiales.map((m) => ({
              idMaterial: byCod.get(m.cod)!.idMaterial,
              cantidadRequerida: m.cant,
              precioUnitarioMomento: cupp(m.cod),
            })),
          },
        },
      });

      if (estado === "Presupuestando") continue; // aún no se ejecuta

      // ---------- 4. CONSUMO de material (salidas del kardex) ----------
      const factorAvance = estado === "Finalizado" ? 1 : 0.6;
      for (const m of p.materiales) {
        const mat = byCod.get(m.cod)!;
        const cant = Math.round(m.cant * factorAvance * 100) / 100;
        if (cant <= 0) continue;
        // Verifica stock: si no alcanza, se omite (el trigger lo rechazaría).
        const actual = await prisma.material.findUniqueOrThrow({
          where: { idMaterial: mat.idMaterial },
          select: { stockActual: true, cupp: true },
        });
        if (Number(String(actual.stockActual)) < cant) continue;
        await prisma.movimientoInventario.create({
          data: {
            idMaterial: mat.idMaterial,
            idObra: obra.idObra,
            tipoMovimiento: "Salida",
            cantidad: cant,
            saldoResultante: 0, // lo calcula el trigger
            costoUnitario: Number(String(actual.cupp)),
            motivo: `Consumo — ${p.tipo}`,
            idUsuario: idOperario,
            fechaMovimiento: fecha(anio, mes, diaInicio + 1),
          },
        });
      }

      // ---------- 5. MANO DE OBRA ----------
      const horasTot = Math.round(p.manoObraH * factorAvance);
      let restantes = horasTot;
      let dia = diaInicio;
      while (restantes > 0) {
        const h = Math.min(8, restantes);
        await prisma.manoObraObra.create({
          data: {
            idObra: obra.idObra,
            idUsuario: idOperario,
            fecha: fecha(anio, mes, Math.min(dia, 28)),
            horas: h,
            tarifaHora: TARIFA_HORA,
            descripcion: `Fabricación — ${p.tipo}`,
          },
        });
        restantes -= h;
        dia++;
      }

      // ---------- 6. PAGOS del cliente ----------
      if (estado === "Finalizado") {
        // 50% adelanto + 50% contra entrega.
        const conIgv = Math.round(p.precio * 1.18 * 100) / 100;
        await prisma.pagoObra.create({
          data: {
            idObra: obra.idObra,
            montoAbonado: Math.round(conIgv * 0.5 * 100) / 100,
            fechaPago: fecha(anio, mes, diaInicio),
            tipoPago: j % 2 === 0 ? "Transferencia" : "Efectivo",
            observaciones: "Adelanto 50%",
            registradoPor: admin.idUsuario,
          },
        });
        await prisma.pagoObra.create({
          data: {
            idObra: obra.idObra,
            montoAbonado: Math.round(conIgv * 0.5 * 100) / 100,
            fechaPago: fecha(anio, mes, diaFin),
            tipoPago: j % 3 === 0 ? "Efectivo" : "Transferencia",
            observaciones: "Cancelación contra entrega",
            registradoPor: admin.idUsuario,
          },
        });
      } else {
        // En ejecución: solo el adelanto.
        await prisma.pagoObra.create({
          data: {
            idObra: obra.idObra,
            montoAbonado: Math.round(p.precio * 1.18 * 0.5 * 100) / 100,
            fechaPago: fecha(anio, mes, diaInicio),
            tipoPago: "Transferencia",
            observaciones: "Adelanto 50%",
            registradoPor: admin.idUsuario,
          },
        });
      }
    }

    // ---------- 7. COSTOS INDIRECTOS del mes ----------
    // Se reparten entre las obras ejecutadas del mes.
    const obrasMes = await prisma.obra.findMany({
      where: {
        descripcion: { contains: "OP-2026" },
        fechaInicio: { gte: fecha(anio, mes, 1), lte: fecha(anio, mes, 28) },
        estadoObra: { not: "Presupuestando" },
      },
      select: { idObra: true },
    });
    if (obrasMes.length > 0) {
      for (const ind of INDIRECTOS_MES) {
        const porObra = Math.round((ind.monto / obrasMes.length) * 100) / 100;
        for (const o of obrasMes) {
          await prisma.costoIndirectoObra.create({
            data: {
              idObra: o.idObra,
              tipo: ind.tipo,
              monto: porObra,
              fecha: fecha(anio, mes, 28),
              descripcion: ind.desc,
              registradoPor: admin.idUsuario,
            },
          });
        }
      }
    }

    console.log(`   ✓ ${["feb", "mar", "abr", "may", "jun", "jul"][i]} 2026: ${plan.trabajos.length} obras`);
  }

  console.log(`\n✅ Operación generada: ${nObras} obras, ${nCompras} compras recibidas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
