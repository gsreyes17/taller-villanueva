import Link from "next/link";
import {
  Factory,
  FileText,
  TrendingUp,
  Package,
  DollarSign,
  AlertTriangle,
  Boxes,
  CalendarClock,
  HandCoins,
  BarChart3,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { cn, formatCurrency, toNumber, saludoHora } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const en15dias = new Date(now.getTime() + 15 * 86400_000);
  const MESES_ATRAS = 3;
  const rangoInicio = new Date(now.getFullYear(), now.getMonth() - (MESES_ATRAS - 1), 1);

  const [
    obrasActivas,
    enPresupuestando,
    presupuestosActivos,
    materiales,
    pagosMes,
    entradasMes,
    obrasPorEntregar,
    bajoStock,
    pagosRango,
    entradasRango,
  ] = await Promise.all([
    prisma.obra.count({ where: { estadoObra: "EnEjecucion" } }),
    prisma.obra.count({ where: { estadoObra: "Presupuestando" } }),
    prisma.presupuesto.findMany({
      where: { obra: { estadoObra: { in: ["EnEjecucion", "Presupuestando"] } } },
      select: { montoTotal: true },
    }),
    prisma.material.findMany({
      where: { estado: "Activo" },
      select: { stockActual: true, stockMinimo: true, cupp: true },
    }),
    prisma.pagoObra.aggregate({
      _sum: { montoAbonado: true },
      _count: true,
      where: { fechaPago: { gte: inicioMes } },
    }),
    prisma.movimientoInventario.findMany({
      where: { tipoMovimiento: "Entrada", fechaMovimiento: { gte: inicioMes } },
      select: { cantidad: true, costoUnitario: true },
    }),
    prisma.obra.count({
      where: {
        estadoObra: { in: ["EnEjecucion", "Presupuestando"] },
        fechaEntregaEstimada: { lte: en15dias },
      },
    }),
    prisma.material.findMany({
      where: { estado: "Activo" },
      select: { idMaterial: true, nombre: true, codigoMaterial: true, stockActual: true, stockMinimo: true },
    }),
    prisma.pagoObra.findMany({
      where: { fechaPago: { gte: rangoInicio } },
      select: { montoAbonado: true, fechaPago: true },
    }),
    prisma.movimientoInventario.findMany({
      where: { tipoMovimiento: "Entrada", fechaMovimiento: { gte: rangoInicio } },
      select: { cantidad: true, costoUnitario: true, fechaMovimiento: true },
    }),
  ]);

  // Balance por mes (últimos meses) para el gráfico de tendencia.
  const meses = Array.from({ length: MESES_ATRAS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MESES_ATRAS - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("es-PE", { month: "long" }),
      anio: d.getFullYear(),
      ingresos: 0,
      egresos: 0,
    };
  });
  const idxMes = (d: Date) => meses.findIndex((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
  for (const p of pagosRango) {
    const i = idxMes(new Date(p.fechaPago));
    if (i >= 0) meses[i].ingresos += toNumber(p.montoAbonado);
  }
  for (const e of entradasRango) {
    const i = idxMes(new Date(e.fechaMovimiento));
    if (i >= 0) meses[i].egresos += toNumber(e.cantidad) * toNumber(e.costoUnitario);
  }
  const maxBarra = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));

  const valorEnObras = presupuestosActivos.reduce((s, p) => s + toNumber(p.montoTotal), 0);
  const inventarioValorizado = materiales.reduce(
    (s, m) => s + toNumber(m.stockActual) * toNumber(m.cupp),
    0,
  );
  const ingresosMes = toNumber(pagosMes._sum.montoAbonado);
  const egresosMes = entradasMes.reduce(
    (s, m) => s + toNumber(m.cantidad) * toNumber(m.costoUnitario),
    0,
  );
  const balance = ingresosMes - egresosMes;
  const materialesBajoStock = bajoStock.filter(
    (m) => toNumber(m.stockActual) <= toNumber(m.stockMinimo),
  );

  const mesLabel = now.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const fechaLarga = now.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">
          {saludoHora()}, {user.nombre} 👋
        </h1>
        <p className="mt-1 text-sm capitalize text-muted">{fechaLarga}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Obras Activas"
          value={obrasActivas}
          hint="En ejecución actualmente"
          accent="blue"
          icon={<Factory size={22} />}
        />
        <StatCard
          label="En Presupuestando"
          value={enPresupuestando}
          hint="Esperando presupuesto"
          accent="orange"
          icon={<FileText size={22} />}
        />
        <StatCard
          label="Valor en Obras"
          value={formatCurrency(valorEnObras, { decimals: 0 })}
          hint={`${obrasActivas + enPresupuestando} obras activas/presupuestadas`}
          accent="green"
          icon={<TrendingUp size={22} />}
        />
        <StatCard
          label="Inventario Valorizado"
          value={formatCurrency(inventarioValorizado, { decimals: 0 })}
          hint={`${materiales.length} ítems activos`}
          accent="purple"
          icon={<Package size={22} />}
        />
      </div>

      {/* Resumen financiero */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-violet-500">
          <CardBody className="pt-5">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-violet-600" />
              <h2 className="text-lg font-semibold capitalize text-ink">
                Resumen Financiero — {mesLabel}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FinanceTile
                tone="green"
                label="Ingresos del Mes"
                value={formatCurrency(ingresosMes)}
                hint={`${pagosMes._count} pagos recibidos`}
              />
              <FinanceTile
                tone="red"
                label="Egresos del Mes"
                value={formatCurrency(egresosMes)}
                hint={`${entradasMes.length} compras registradas`}
              />
              <FinanceTile
                tone="blue"
                label="Balance del Mes"
                value={formatCurrency(balance)}
                hint={balance >= 0 ? "✓ Resultado positivo" : "Resultado negativo"}
              />
            </div>
          </CardBody>
        </div>
      </Card>

      {/* Balance mensual (tendencia) */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-emerald-500">
          <CardBody className="pt-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-ink">Balance Mensual</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {meses.map((m) => {
                const bal = m.ingresos - m.egresos;
                return (
                  <div key={m.key} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold capitalize text-ink">
                      {m.label} {m.anio}
                    </p>
                    <div className="mt-3 space-y-2.5">
                      <BalanceBar label="Ingresos" value={m.ingresos} max={maxBarra} tone="green" />
                      <BalanceBar label="Egresos" value={m.egresos} max={maxBarra} tone="red" />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-xs text-muted">Balance</span>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          bal >= 0 ? "text-emerald-600" : "text-red-600",
                        )}
                      >
                        {formatCurrency(bal, { decimals: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </div>
      </Card>

      {/* Alertas */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-red-500">
          <CardBody className="pt-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" />
              <h2 className="text-lg font-semibold text-ink">Alertas del Sistema</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <AlertTile
                label="Stock Bajo"
                value={materialesBajoStock.length}
                icon={<Boxes size={20} />}
              />
              <AlertTile
                label="Obras por Entregar (15 días)"
                value={obrasPorEntregar}
                icon={<CalendarClock size={20} />}
              />
              <AlertTile
                label="Pagos del Mes"
                value={pagosMes._count}
                icon={<HandCoins size={20} />}
              />
            </div>

            {materialesBajoStock.length > 0 && (
              <div className="mt-5 space-y-2">
                {materialesBajoStock.slice(0, 4).map((m) => (
                  <div
                    key={m.idMaterial}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Stock crítico de {m.nombre}
                      </p>
                      <p className="text-xs text-muted">
                        Stock actual ({toNumber(m.stockActual)}) por debajo del mínimo (
                        {toNumber(m.stockMinimo)})
                      </p>
                    </div>
                    <Link
                      href="/inventario"
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50"
                    >
                      Resolver
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </div>
      </Card>
    </div>
  );
}

function BalanceBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "green" | "red";
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-ink">{formatCurrency(value, { decimals: 0 })}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", tone === "green" ? "bg-emerald-500" : "bg-red-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FinanceTile({
  tone,
  label,
  value,
  hint,
}: {
  tone: "green" | "red" | "blue";
  label: string;
  value: string;
  hint: string;
}) {
  const styles = {
    green: "border-emerald-200 bg-emerald-50/60",
    red: "border-red-200 bg-red-50/60",
    blue: "border-blue-200 bg-blue-50/60",
  }[tone];
  return (
    <div className={`rounded-xl border ${styles} px-4 py-4`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function AlertTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      </div>
      <span className="text-amber-500">{icon}</span>
    </div>
  );
}
