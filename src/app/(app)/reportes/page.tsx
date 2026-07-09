import Link from "next/link";
import {
  Package,
  TrendingUp,
  BarChart3,
  DollarSign,
  ShoppingCart,
  Users,
  FileText,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

type ReporteDef = {
  tipo: string;
  titulo: string;
  descripcion: string;
  icon: React.ReactNode;
  iconWrap: string;
};

const operativos: ReporteDef[] = [
  {
    tipo: "inventario",
    titulo: "Reporte de Inventario",
    descripcion: "Estado actual, valorización y alertas",
    icon: <Package size={22} />,
    iconWrap: "bg-blue-50 text-blue-600",
  },
  {
    tipo: "avance-obras",
    titulo: "Reporte de Avance de Obras",
    descripcion: "Seguimiento de todas las obras activas",
    icon: <TrendingUp size={22} />,
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  {
    tipo: "consumo",
    titulo: "Histórico de Consumo",
    descripcion: "Consumo de materiales por período",
    icon: <BarChart3 size={22} />,
    iconWrap: "bg-violet-50 text-violet-600",
  },
];

const financieros: ReporteDef[] = [
  {
    tipo: "financiero-obra",
    titulo: "Reporte Financiero por Obra",
    descripcion: "Rentabilidad y costos reales vs presupuesto",
    icon: <DollarSign size={22} />,
    iconWrap: "bg-orange-50 text-brand",
  },
  {
    tipo: "compras",
    titulo: "Reporte de Compras",
    descripcion: "Entradas de material y costos",
    icon: <ShoppingCart size={22} />,
    iconWrap: "bg-blue-50 text-blue-600",
  },
  {
    tipo: "pagos",
    titulo: "Reporte de Pagos de Clientes",
    descripcion: "Estado de cobranza por obra",
    icon: <Users size={22} />,
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
];

function ReportCard({
  def,
  href,
  badge,
  disabled,
}: {
  def: ReporteDef;
  href?: string;
  badge?: boolean;
  disabled?: boolean;
}) {
  const boton = (
    <Button variant="secondary" className="w-full" disabled={disabled}>
      <FileText size={16} />
      Generar Reporte
    </Button>
  );

  return (
    <Card className="relative flex h-full flex-col">
      {badge && (
        <div className="absolute right-4 top-4">
          <Badge tone="gray">Solo Administrador</Badge>
        </div>
      )}
      <CardBody className="flex flex-1 flex-col pt-5">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${def.iconWrap}`}
        >
          {def.icon}
        </div>
        <h3 className="text-base font-semibold text-ink">{def.titulo}</h3>
        <p className="mt-1 flex-1 text-sm text-muted">{def.descripcion}</p>
        <div className="mt-4">
          {href ? <Link href={href}>{boton}</Link> : boton}
        </div>
      </CardBody>
    </Card>
  );
}

export default async function ReportesPage() {
  const user = await requireUser();
  const esAdmin = user.rol === "Administrador";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Centro de Reportes y Análisis"
        subtitle="Generar y consultar reportes del sistema"
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Reportes Operativos</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {operativos.map((def) => (
            <ReportCard key={def.tipo} def={def} href={`/reportes/${def.tipo}`} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Reportes Financieros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {financieros.map((def) => (
            <ReportCard
              key={def.tipo}
              def={def}
              badge
              href={esAdmin ? `/reportes/${def.tipo}` : undefined}
              disabled={!esAdmin}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
