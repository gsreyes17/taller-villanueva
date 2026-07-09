import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Package,
  DollarSign,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDate, toNumber } from "@/lib/utils";
import { PrintButton } from "../print-button";

export const dynamic = "force-dynamic";

const FINANCIEROS = new Set(["financiero-obra", "compras", "pagos"]);

/** Convierte el enum estadoObra de Prisma a etiqueta legible. */
function estadoObraLabel(estado: string): string {
  const map: Record<string, string> = {
    Presupuestando: "Presupuestando",
    EnEjecucion: "En Ejecución",
    Finalizado: "Finalizado",
    Cancelado: "Cancelado",
  };
  return map[estado] ?? estado;
}

export default async function ReporteVisorPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const user = await requireUser();

  if (FINANCIEROS.has(tipo) && user.rol !== "Administrador") {
    redirect("/reportes");
  }

  const fechaGeneracion = formatDate(new Date());
  const body = await renderReporte(tipo);

  if (!body) {
    return (
      <div className="space-y-6">
        <VolverBar />
        <div className="rounded-[var(--radius-card)] border border-slate-200/70 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-lg font-semibold text-ink">Reporte no encontrado</p>
          <p className="mt-1 text-sm text-muted">
            El tipo de reporte solicitado no existe.
          </p>
          <Link
            href="/reportes"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            <ArrowLeft size={16} /> Volver a reportes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VolverBar />
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{body.titulo}</h1>
            <p className="mt-0.5 text-sm text-muted">
              Generado el {fechaGeneracion}
            </p>
          </div>
          <PrintButton />
        </div>
        {body.content}
      </div>
    </div>
  );
}

function VolverBar() {
  return (
    <Link
      href="/reportes"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink print:hidden"
    >
      <ArrowLeft size={16} /> Volver a reportes
    </Link>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

type ReporteBody = { titulo: string; content: React.ReactNode };

async function renderReporte(tipo: string): Promise<ReporteBody | null> {
  switch (tipo) {
    case "inventario":
      return reporteInventario();
    case "avance-obras":
      return reporteAvanceObras();
    case "consumo":
      return reporteConsumo();
    case "financiero-obra":
      return reporteFinancieroObra();
    case "compras":
      return reporteCompras();
    case "pagos":
      return reportePagos();
    default:
      return null;
  }
}

/* ------------------------- Inventario ------------------------- */
async function reporteInventario(): Promise<ReporteBody> {
  const materiales = await prisma.material.findMany({
    orderBy: { nombre: "asc" },
  });

  const rows = materiales.map((m) => {
    const stock = toNumber(m.stockActual);
    const minimo = toNumber(m.stockMinimo);
    const cupp = toNumber(m.cupp);
    return {
      id: m.idMaterial,
      codigo: m.codigoMaterial,
      nombre: m.nombre,
      unidad: m.unidadMedida,
      stock,
      minimo,
      cupp,
      valor: stock * cupp,
      bajo: stock <= minimo,
    };
  });

  const valorTotal = rows.reduce((s, r) => s + r.valor, 0);
  const bajoStock = rows.filter((r) => r.bajo).length;

  return {
    titulo: "Reporte de Inventario",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total de Materiales"
            value={rows.length}
            accent="blue"
            icon={<Package size={22} />}
          />
          <StatCard
            label="Valor Total de Inventario"
            value={formatCurrency(valorTotal)}
            accent="green"
            icon={<DollarSign size={22} />}
          />
          <StatCard
            label="Materiales en Bajo Stock"
            value={bajoStock}
            accent="red"
            hint="Stock igual o menor al mínimo"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Código</Th>
              <Th>Material</Th>
              <Th className="text-right">Stock Actual</Th>
              <Th className="text-right">Stock Mínimo</Th>
              <Th className="text-right">CUPP</Th>
              <Th className="text-right">Valorización</Th>
              <Th>Estado</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.codigo}</Td>
                  <Td>{r.nombre}</Td>
                  <Td className="text-right">
                    {formatNumber(r.stock, 2)} {r.unidad}
                  </Td>
                  <Td className="text-right">{formatNumber(r.minimo, 2)}</Td>
                  <Td className="text-right">{formatCurrency(r.cupp)}</Td>
                  <Td className="text-right font-semibold">
                    {formatCurrency(r.valor)}
                  </Td>
                  <Td>
                    <EstadoBadge estado={r.bajo ? "Bajo stock" : "Normal"} />
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

/* ------------------------- Avance de obras ------------------------- */
async function reporteAvanceObras(): Promise<ReporteBody> {
  const obras = await prisma.obra.findMany({
    where: { estadoObra: { not: "Cancelado" } },
    include: { cliente: true },
    orderBy: { fechaInicio: "desc" },
  });

  const avances = obras.map((o) => toNumber(o.porcentajeAvance));
  const avancePromedio =
    avances.length > 0 ? avances.reduce((s, a) => s + a, 0) / avances.length : 0;

  return {
    titulo: "Reporte de Avance de Obras",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Obras Activas"
            value={obras.length}
            accent="blue"
            icon={<TrendingUp size={22} />}
            hint="Excluye obras canceladas"
          />
          <StatCard
            label="Avance Promedio"
            value={`${formatNumber(avancePromedio, 1)}%`}
            accent="green"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Obra</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th>Avance</Th>
              <Th>Inicio</Th>
              <Th>Entrega Estimada</Th>
            </Tr>
          </Thead>
          <tbody>
            {obras.length === 0 ? (
              <EmptyRow colSpan={6} />
            ) : (
              obras.map((o) => {
                const avance = toNumber(o.porcentajeAvance);
                return (
                  <Tr key={o.idObra}>
                    <Td className="font-medium">{o.nombreObra}</Td>
                    <Td>{o.cliente.nombreRazonSocial}</Td>
                    <Td>
                      <EstadoBadge estado={estadoObraLabel(o.estadoObra)} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.min(100, Math.max(0, avance))}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted">
                          {formatNumber(avance, 0)}%
                        </span>
                      </div>
                    </Td>
                    <Td>{formatDate(o.fechaInicio)}</Td>
                    <Td>{formatDate(o.fechaEntregaEstimada)}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

/* ------------------------- Consumo ------------------------- */
async function reporteConsumo(): Promise<ReporteBody> {
  const salidas = await prisma.movimientoInventario.findMany({
    where: { tipoMovimiento: "Salida" },
    include: { material: true },
  });

  const map = new Map<
    number,
    { nombre: string; codigo: string; unidad: string; cantidad: number; movimientos: number }
  >();

  for (const mov of salidas) {
    const key = mov.idMaterial;
    const prev = map.get(key);
    const cantidad = toNumber(mov.cantidad);
    if (prev) {
      prev.cantidad += cantidad;
      prev.movimientos += 1;
    } else {
      map.set(key, {
        nombre: mov.material.nombre,
        codigo: mov.material.codigoMaterial,
        unidad: mov.material.unidadMedida,
        cantidad,
        movimientos: 1,
      });
    }
  }

  const rows = Array.from(map.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const totalSalidas = salidas.length;

  return {
    titulo: "Histórico de Consumo de Materiales",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total de Salidas"
            value={totalSalidas}
            accent="purple"
            icon={<BarChart3 size={22} />}
            hint="Movimientos de tipo salida"
          />
          <StatCard
            label="Materiales Distintos Consumidos"
            value={rows.length}
            accent="blue"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Código</Th>
              <Th>Material</Th>
              <Th className="text-right">Cantidad Consumida</Th>
              <Th className="text-right">N.º de Salidas</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.codigo}</Td>
                  <Td>{r.nombre}</Td>
                  <Td className="text-right font-semibold">
                    {formatNumber(r.cantidad, 2)} {r.unidad}
                  </Td>
                  <Td className="text-right">{r.movimientos}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

/* ------------------------- Financiero por obra ------------------------- */
async function reporteFinancieroObra(): Promise<ReporteBody> {
  const obras = await prisma.obra.findMany({
    where: { presupuesto: { isNot: null } },
    include: { cliente: true, presupuesto: true, pagos: true },
    orderBy: { fechaInicio: "desc" },
  });

  const rows = obras
    .filter((o) => o.presupuesto)
    .map((o) => {
      const p = o.presupuesto!;
      const montoTotal = toNumber(p.montoTotal);
      const abonado = o.pagos.reduce((s, pago) => s + toNumber(pago.montoAbonado), 0);
      const costos =
        toNumber(p.costoMaterialesBase) +
        toNumber(p.costoMermas) +
        toNumber(p.costoManoObra);
      return {
        id: o.idObra,
        obra: o.nombreObra,
        cliente: o.cliente.nombreRazonSocial,
        montoTotal,
        abonado,
        saldo: montoTotal - abonado,
        costos,
      };
    });

  const totalPresupuestado = rows.reduce((s, r) => s + r.montoTotal, 0);
  const totalCobrado = rows.reduce((s, r) => s + r.abonado, 0);
  const saldoPorCobrar = rows.reduce((s, r) => s + r.saldo, 0);

  return {
    titulo: "Reporte Financiero por Obra",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Valor Total Presupuestado"
            value={formatCurrency(totalPresupuestado)}
            accent="blue"
            icon={<DollarSign size={22} />}
          />
          <StatCard
            label="Total Cobrado"
            value={formatCurrency(totalCobrado)}
            accent="green"
          />
          <StatCard
            label="Saldo por Cobrar"
            value={formatCurrency(saldoPorCobrar)}
            accent="orange"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Obra</Th>
              <Th>Cliente</Th>
              <Th className="text-right">Monto Total</Th>
              <Th className="text-right">Costos Reales</Th>
              <Th className="text-right">Abonado</Th>
              <Th className="text-right">Saldo Pendiente</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.obra}</Td>
                  <Td>{r.cliente}</Td>
                  <Td className="text-right">{formatCurrency(r.montoTotal)}</Td>
                  <Td className="text-right">{formatCurrency(r.costos)}</Td>
                  <Td className="text-right">{formatCurrency(r.abonado)}</Td>
                  <Td className="text-right font-semibold">
                    {formatCurrency(r.saldo)}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

/* ------------------------- Compras ------------------------- */
async function reporteCompras(): Promise<ReporteBody> {
  const entradas = await prisma.movimientoInventario.findMany({
    where: { tipoMovimiento: "Entrada" },
    include: { material: true },
    orderBy: { fechaMovimiento: "desc" },
  });

  const rows = entradas.map((e) => {
    const cantidad = toNumber(e.cantidad);
    const costoUnitario = toNumber(e.costoUnitario);
    return {
      id: e.idMovimiento,
      material: e.material.nombre,
      unidad: e.material.unidadMedida,
      cantidad,
      costoUnitario,
      total: cantidad * costoUnitario,
      fecha: e.fechaMovimiento,
    };
  });

  const totalCompras = rows.reduce((s, r) => s + r.total, 0);

  return {
    titulo: "Reporte de Compras",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total de Compras"
            value={formatCurrency(totalCompras)}
            accent="blue"
            icon={<ShoppingCart size={22} />}
          />
          <StatCard
            label="N.º de Entradas"
            value={rows.length}
            accent="green"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Fecha</Th>
              <Th>Material</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Costo Unitario</Th>
              <Th className="text-right">Costo Total</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              rows.map((r) => (
                <Tr key={String(r.id)}>
                  <Td>{formatDate(r.fecha)}</Td>
                  <Td className="font-medium">{r.material}</Td>
                  <Td className="text-right">
                    {formatNumber(r.cantidad, 2)} {r.unidad}
                  </Td>
                  <Td className="text-right">{formatCurrency(r.costoUnitario)}</Td>
                  <Td className="text-right font-semibold">
                    {formatCurrency(r.total)}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

/* ------------------------- Pagos ------------------------- */
async function reportePagos(): Promise<ReporteBody> {
  const pagos = await prisma.pagoObra.findMany({
    include: { obra: { include: { cliente: true } } },
    orderBy: { fechaPago: "desc" },
  });

  const totalCobrado = pagos.reduce((s, p) => s + toNumber(p.montoAbonado), 0);

  return {
    titulo: "Reporte de Pagos de Clientes",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total Cobrado"
            value={formatCurrency(totalCobrado)}
            accent="green"
            icon={<DollarSign size={22} />}
          />
          <StatCard
            label="N.º de Pagos"
            value={pagos.length}
            accent="blue"
            icon={<Users size={22} />}
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Fecha</Th>
              <Th>Obra</Th>
              <Th>Cliente</Th>
              <Th>Tipo de Pago</Th>
              <Th className="text-right">Monto Abonado</Th>
            </Tr>
          </Thead>
          <tbody>
            {pagos.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              pagos.map((p) => (
                <Tr key={p.idPago}>
                  <Td>{formatDate(p.fechaPago)}</Td>
                  <Td className="font-medium">{p.obra.nombreObra}</Td>
                  <Td>{p.obra.cliente.nombreRazonSocial}</Td>
                  <Td>
                    <Badge tone="gray">{p.tipoPago}</Badge>
                  </Td>
                  <Td className="text-right font-semibold">
                    {formatCurrency(p.montoAbonado)}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </>
    ),
  };
}

export const metadata = {
  title: "Reporte | Taller Villanueva",
};
