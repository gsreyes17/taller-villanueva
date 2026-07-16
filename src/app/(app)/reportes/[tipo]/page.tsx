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
  Percent,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDate, toNumber } from "@/lib/utils";
import { PrintButton } from "../print-button";
import { Filtros, type OpcionFiltro } from "../filtros";

export const dynamic = "force-dynamic";

const FINANCIEROS = new Set(["financiero-obra", "compras", "pagos", "rentabilidad"]);

const ESTADOS_OBRA_VALIDOS = new Set([
  "Presupuestando",
  "EnEjecucion",
  "Finalizado",
  "Cancelado",
]);

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

type SearchParams = {
  desde?: string;
  hasta?: string;
  idCliente?: string;
  idObra?: string;
  idProveedor?: string;
  idCategoria?: string;
  zona?: string;
  estadoObra?: string;
  bajoStock?: string;
};

/** Filtros ya parseados y validados, listos para usar en los `where`. */
type FiltrosParsed = {
  desde?: Date;
  hasta?: Date;
  desdeRaw?: string;
  hastaRaw?: string;
  idCliente?: number;
  idObra?: number;
  idProveedor?: number;
  idCategoria?: number;
  zona?: string;
  estadoObra?: "Presupuestando" | "EnEjecucion" | "Finalizado" | "Cancelado";
  bajoStock: boolean;
};

function parseId(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseFecha(value: string | undefined, finDeDia: boolean): Date | undefined {
  if (!value) return undefined;
  const d = new Date(finDeDia ? `${value}T23:59:59` : value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseFiltros(sp: SearchParams): FiltrosParsed {
  const desde = parseFecha(sp.desde, false);
  const hasta = parseFecha(sp.hasta, true);
  const estadoObra =
    sp.estadoObra && ESTADOS_OBRA_VALIDOS.has(sp.estadoObra)
      ? (sp.estadoObra as FiltrosParsed["estadoObra"])
      : undefined;
  return {
    desde,
    hasta,
    desdeRaw: desde ? sp.desde : undefined,
    hastaRaw: hasta ? sp.hasta : undefined,
    idCliente: parseId(sp.idCliente),
    idObra: parseId(sp.idObra),
    idProveedor: parseId(sp.idProveedor),
    idCategoria: parseId(sp.idCategoria),
    zona: sp.zona || undefined,
    estadoObra,
    bajoStock: sp.bajoStock === "1",
  };
}

/**
 * Construye el filtro de rango para un campo de fecha. Devuelve `undefined`
 * cuando no hay rango, para no añadir cláusulas vacías al `where`.
 */
function rangoFecha(f: FiltrosParsed): { gte?: Date; lte?: Date } | undefined {
  if (!f.desde && !f.hasta) return undefined;
  return { ...(f.desde && { gte: f.desde }), ...(f.hasta && { lte: f.hasta }) };
}

export default async function ReporteVisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tipo } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  if (FINANCIEROS.has(tipo) && user.rol !== "Administrador") {
    redirect("/reportes");
  }

  const filtros = parseFiltros(sp);
  const fechaGeneracion = formatDate(new Date());
  const body = await renderReporte(tipo, filtros);

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

  const opciones = await cargarOpciones(tipo);
  const resumen = await resumenFiltros(filtros);

  return (
    <div className="space-y-6">
      <VolverBar />
      <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{body.titulo}</h1>
            <p className="mt-0.5 text-sm text-muted">
              Generado el {fechaGeneracion}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{resumen}</p>
          </div>
          <PrintButton />
        </div>
        {opciones && <Filtros {...opciones} />}
        {body.content}
      </div>
    </div>
  );
}

/* ------------------------- Config de filtros por reporte ------------------------- */

type VisibilidadFiltros = {
  mostrarCliente?: boolean;
  mostrarObra?: boolean;
  mostrarProveedor?: boolean;
  mostrarCategoria?: boolean;
  mostrarZona?: boolean;
  mostrarEstadoObra?: boolean;
  mostrarBajoStock?: boolean;
};

const VISIBILIDAD: Record<string, VisibilidadFiltros> = {
  inventario: { mostrarCategoria: true, mostrarZona: true, mostrarBajoStock: true },
  "avance-obras": { mostrarCliente: true, mostrarEstadoObra: true },
  consumo: { mostrarObra: true, mostrarCategoria: true, mostrarZona: true },
  "financiero-obra": { mostrarCliente: true },
  compras: { mostrarProveedor: true },
  pagos: { mostrarCliente: true, mostrarObra: true },
  rentabilidad: { mostrarCliente: true, mostrarObra: true, mostrarEstadoObra: true },
};

/**
 * Carga sólo las listas que el reporte actual necesita para su barra de
 * filtros, y las devuelve como props planos y serializables.
 */
async function cargarOpciones(tipo: string) {
  const vis = VISIBILIDAD[tipo];
  if (!vis) return null;

  const [clientes, obras, proveedores, categorias, ubicaciones] = await Promise.all([
    vis.mostrarCliente
      ? prisma.cliente.findMany({
          select: { idCliente: true, nombreRazonSocial: true },
          orderBy: { nombreRazonSocial: "asc" },
        })
      : Promise.resolve([]),
    vis.mostrarObra
      ? prisma.obra.findMany({
          select: { idObra: true, nombreObra: true },
          orderBy: { nombreObra: "asc" },
        })
      : Promise.resolve([]),
    vis.mostrarProveedor
      ? prisma.proveedor.findMany({
          select: { idProveedor: true, razonSocial: true },
          orderBy: { razonSocial: "asc" },
        })
      : Promise.resolve([]),
    vis.mostrarCategoria
      ? prisma.categoria.findMany({
          select: { idCategoria: true, nombre: true },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve([]),
    vis.mostrarZona
      ? prisma.ubicacion.findMany({
          select: { zona: true },
          distinct: ["zona"],
          orderBy: { zona: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    ...vis,
    clientes: clientes.map<OpcionFiltro>((c) => ({
      id: c.idCliente,
      label: c.nombreRazonSocial,
    })),
    obras: obras.map<OpcionFiltro>((o) => ({ id: o.idObra, label: o.nombreObra })),
    proveedores: proveedores.map<OpcionFiltro>((p) => ({
      id: p.idProveedor,
      label: p.razonSocial,
    })),
    categorias: categorias.map<OpcionFiltro>((c) => ({
      id: c.idCategoria,
      label: c.nombre,
    })),
    zonas: ubicaciones.map((u) => u.zona),
  };
}

/** Resumen legible de los filtros activos, para mostrar bajo el título. */
async function resumenFiltros(f: FiltrosParsed): Promise<string> {
  const partes: string[] = [];

  if (f.desdeRaw || f.hastaRaw) {
    const desde = f.desdeRaw ? formatDate(f.desdeRaw) : "Inicio";
    const hasta = f.hastaRaw ? formatDate(f.hastaRaw) : "Hoy";
    partes.push(`Periodo: ${desde} — ${hasta}`);
  }

  const [cliente, obra, proveedor, categoria] = await Promise.all([
    f.idCliente
      ? prisma.cliente.findUnique({
          where: { idCliente: f.idCliente },
          select: { nombreRazonSocial: true },
        })
      : Promise.resolve(null),
    f.idObra
      ? prisma.obra.findUnique({
          where: { idObra: f.idObra },
          select: { nombreObra: true },
        })
      : Promise.resolve(null),
    f.idProveedor
      ? prisma.proveedor.findUnique({
          where: { idProveedor: f.idProveedor },
          select: { razonSocial: true },
        })
      : Promise.resolve(null),
    f.idCategoria
      ? prisma.categoria.findUnique({
          where: { idCategoria: f.idCategoria },
          select: { nombre: true },
        })
      : Promise.resolve(null),
  ]);

  if (cliente) partes.push(`Cliente: ${cliente.nombreRazonSocial}`);
  if (obra) partes.push(`Obra: ${obra.nombreObra}`);
  if (proveedor) partes.push(`Proveedor: ${proveedor.razonSocial}`);
  if (categoria) partes.push(`Categoría: ${categoria.nombre}`);
  if (f.zona) partes.push(`Zona: ${f.zona}`);
  if (f.estadoObra) partes.push(`Estado: ${estadoObraLabel(f.estadoObra)}`);
  if (f.bajoStock) partes.push("Solo bajo stock");

  return partes.length > 0 ? partes.join(" · ") : "Todos los registros";
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

async function renderReporte(
  tipo: string,
  f: FiltrosParsed,
): Promise<ReporteBody | null> {
  switch (tipo) {
    case "inventario":
      return reporteInventario(f);
    case "avance-obras":
      return reporteAvanceObras(f);
    case "consumo":
      return reporteConsumo(f);
    case "financiero-obra":
      return reporteFinancieroObra(f);
    case "compras":
      return reporteCompras(f);
    case "pagos":
      return reportePagos(f);
    case "rentabilidad":
      return reporteRentabilidad(f);
    default:
      return null;
  }
}

/* ------------------------- Inventario ------------------------- */
async function reporteInventario(f: FiltrosParsed): Promise<ReporteBody> {
  const materiales = await prisma.material.findMany({
    where: {
      ...(f.idCategoria && { idCategoria: f.idCategoria }),
      ...(f.zona && { ubicacion: { zona: f.zona } }),
    },
    include: { categoria: true, unidad: true, ubicacion: true },
    orderBy: { nombre: "asc" },
  });

  const todas = materiales.map((m) => {
    const stock = toNumber(m.stockActual);
    const minimo = toNumber(m.stockMinimo);
    const cupp = toNumber(m.cupp);
    return {
      id: m.idMaterial,
      codigo: m.codigoMaterial,
      nombre: m.nombre,
      categoria: m.categoria.nombre,
      unidad: m.unidad.simbolo,
      zona: m.ubicacion?.zona ?? "—",
      stock,
      minimo,
      cupp,
      valor: stock * cupp,
      bajo: stock <= minimo,
    };
  });

  // El "bajo stock" compara dos columnas (stockActual <= stockMinimo), algo que
  // Prisma no expresa en `where`; se filtra en memoria.
  const rows = f.bajoStock ? todas.filter((r) => r.bajo) : todas;

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
              <Th>Categoría</Th>
              <Th>Zona</Th>
              <Th className="text-right">Stock Actual</Th>
              <Th className="text-right">Stock Mínimo</Th>
              <Th className="text-right">CUPP</Th>
              <Th className="text-right">Valorización</Th>
              <Th>Estado</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={9} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.codigo}</Td>
                  <Td>{r.nombre}</Td>
                  <Td>{r.categoria}</Td>
                  <Td>{r.zona}</Td>
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
async function reporteAvanceObras(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const obras = await prisma.obra.findMany({
    where: {
      // Si el usuario pide explícitamente un estado, se respeta; si no, se
      // mantiene el comportamiento original (excluir canceladas).
      ...(f.estadoObra
        ? { estadoObra: f.estadoObra }
        : { estadoObra: { not: "Cancelado" as const } }),
      ...(f.idCliente && { idCliente: f.idCliente }),
      ...(rango && { fechaInicio: rango }),
    },
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
            hint={f.estadoObra ? undefined : "Excluye obras canceladas"}
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
async function reporteConsumo(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const salidas = await prisma.movimientoInventario.findMany({
    where: {
      tipoMovimiento: "Salida",
      ...(f.idObra && { idObra: f.idObra }),
      ...(rango && { fechaMovimiento: rango }),
      ...((f.idCategoria || f.zona) && {
        material: {
          ...(f.idCategoria && { idCategoria: f.idCategoria }),
          ...(f.zona && { ubicacion: { zona: f.zona } }),
        },
      }),
    },
    include: { material: { include: { categoria: true, unidad: true } } },
  });

  const map = new Map<
    number,
    {
      nombre: string;
      codigo: string;
      categoria: string;
      unidad: string;
      cantidad: number;
      movimientos: number;
    }
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
        categoria: mov.material.categoria.nombre,
        unidad: mov.material.unidad.simbolo,
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
              <Th>Categoría</Th>
              <Th className="text-right">Cantidad Consumida</Th>
              <Th className="text-right">N.º de Salidas</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.codigo}</Td>
                  <Td>{r.nombre}</Td>
                  <Td>{r.categoria}</Td>
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
async function reporteFinancieroObra(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const obras = await prisma.obra.findMany({
    where: {
      presupuesto: { isNot: null },
      ...(f.idCliente && { idCliente: f.idCliente }),
      ...(rango && { fechaInicio: rango }),
    },
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
async function reporteCompras(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const compras = await prisma.compra.findMany({
    where: {
      estado: "Recibida",
      ...(f.idProveedor && { idProveedor: f.idProveedor }),
      ...(rango && { fechaEmision: rango }),
    },
    include: { proveedor: true, detalles: { include: { material: true } } },
    orderBy: { fechaEmision: "desc" },
  });

  const rows = compras.map((c) => ({
    id: c.idCompra,
    fecha: c.fechaEmision,
    documento: c.numeroDocumento,
    proveedor: c.proveedor.razonSocial,
    ruc: c.proveedor.ruc,
    items: c.detalles.length,
    subtotal: toNumber(c.subtotal),
    flete: toNumber(c.flete),
    igv: toNumber(c.igvMonto),
    total: toNumber(c.total),
  }));

  const totalComprado = rows.reduce((s, r) => s + r.total, 0);
  const igvTotal = rows.reduce((s, r) => s + r.igv, 0);

  return {
    titulo: "Reporte de Compras",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total Comprado"
            value={formatCurrency(totalComprado)}
            accent="blue"
            icon={<ShoppingCart size={22} />}
            hint="Compras en estado Recibida"
          />
          <StatCard label="N.º de Compras" value={rows.length} accent="green" />
          <StatCard
            label="IGV Total"
            value={formatCurrency(igvTotal)}
            accent="purple"
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Fecha Emisión</Th>
              <Th>N.º Documento</Th>
              <Th>Proveedor</Th>
              <Th className="text-right">N.º de Ítems</Th>
              <Th className="text-right">Subtotal</Th>
              <Th className="text-right">Flete</Th>
              <Th className="text-right">IGV</Th>
              <Th className="text-right">Total</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={8} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>{formatDate(r.fecha)}</Td>
                  <Td className="font-medium">{r.documento}</Td>
                  <Td>{r.proveedor}</Td>
                  <Td className="text-right">{r.items}</Td>
                  <Td className="text-right">{formatCurrency(r.subtotal)}</Td>
                  <Td className="text-right">{formatCurrency(r.flete)}</Td>
                  <Td className="text-right">{formatCurrency(r.igv)}</Td>
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
async function reportePagos(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const pagos = await prisma.pagoObra.findMany({
    where: {
      ...(f.idObra && { idObra: f.idObra }),
      ...(f.idCliente && { obra: { idCliente: f.idCliente } }),
      ...(rango && { fechaPago: rango }),
    },
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

/* ------------------------- Rentabilidad ------------------------- */
async function reporteRentabilidad(f: FiltrosParsed): Promise<ReporteBody> {
  const rango = rangoFecha(f);
  const obras = await prisma.obra.findMany({
    where: {
      ...(f.idCliente && { idCliente: f.idCliente }),
      ...(f.idObra && { idObra: f.idObra }),
      ...(f.estadoObra && { estadoObra: f.estadoObra }),
      ...(rango && { fechaInicio: rango }),
    },
    include: {
      cliente: true,
      presupuesto: true,
      pagos: true,
      manoObra: true,
      costosIndirectos: true,
      movimientos: { where: { tipoMovimiento: "Salida" } },
    },
    orderBy: { fechaInicio: "desc" },
  });

  const rows = obras.map((o) => {
    const presupuestado = toNumber(o.presupuesto?.montoTotal);

    const costoMateriales = o.movimientos.reduce(
      (s, m) => s + toNumber(m.cantidad) * toNumber(m.costoUnitario),
      0,
    );
    const costoManoObra = o.manoObra.reduce(
      (s, m) => s + toNumber(m.horas) * toNumber(m.tarifaHora),
      0,
    );
    const costosIndirectos = o.costosIndirectos.reduce(
      (s, c) => s + toNumber(c.monto),
      0,
    );
    const costoTotal = costoMateriales + costoManoObra + costosIndirectos;
    const margen = presupuestado - costoTotal;
    // Sin presupuesto no hay base contra la cual medir el margen: 0%.
    const margenPct = presupuestado > 0 ? (margen / presupuestado) * 100 : 0;

    return {
      id: o.idObra,
      obra: o.nombreObra,
      cliente: o.cliente.nombreRazonSocial,
      estado: o.estadoObra,
      presupuestado,
      costoMateriales,
      costoManoObra,
      costosIndirectos,
      costoTotal,
      margen,
      margenPct,
    };
  });

  const totalPresupuestado = rows.reduce((s, r) => s + r.presupuestado, 0);
  const costoRealTotal = rows.reduce((s, r) => s + r.costoTotal, 0);
  const margenGlobal = totalPresupuestado - costoRealTotal;

  return {
    titulo: "Reporte de Rentabilidad por Obra",
    content: (
      <>
        <StatGrid>
          <StatCard
            label="Total Presupuestado"
            value={formatCurrency(totalPresupuestado)}
            accent="blue"
            icon={<DollarSign size={22} />}
          />
          <StatCard
            label="Costo Real Total"
            value={formatCurrency(costoRealTotal)}
            accent="orange"
            hint="Materiales + mano de obra + indirectos"
          />
          <StatCard
            label="Margen Global"
            value={formatCurrency(margenGlobal)}
            accent={margenGlobal >= 0 ? "green" : "red"}
            icon={<Percent size={22} />}
          />
        </StatGrid>

        <Table>
          <Thead>
            <Tr>
              <Th>Obra</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th className="text-right">Presupuestado</Th>
              <Th className="text-right">Materiales</Th>
              <Th className="text-right">Mano de Obra</Th>
              <Th className="text-right">Indirectos</Th>
              <Th className="text-right">Costo Total</Th>
              <Th className="text-right">Margen</Th>
              <Th className="text-right">Margen %</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={10} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.obra}</Td>
                  <Td>{r.cliente}</Td>
                  <Td>
                    <EstadoBadge estado={estadoObraLabel(r.estado)} />
                  </Td>
                  <Td className="text-right">{formatCurrency(r.presupuestado)}</Td>
                  <Td className="text-right">{formatCurrency(r.costoMateriales)}</Td>
                  <Td className="text-right">{formatCurrency(r.costoManoObra)}</Td>
                  <Td className="text-right">{formatCurrency(r.costosIndirectos)}</Td>
                  <Td className="text-right">{formatCurrency(r.costoTotal)}</Td>
                  <Td className="text-right font-semibold">
                    {formatCurrency(r.margen)}
                  </Td>
                  <Td className="text-right">
                    <Badge tone={r.margen >= 0 ? "green" : "red"}>
                      {formatNumber(r.margenPct, 1)}%
                    </Badge>
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
