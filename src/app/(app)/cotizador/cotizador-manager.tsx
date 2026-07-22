"use client";

import { useState } from "react";
import { Plus, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { CotizacionForm } from "./nuevo/cotizacion-form";

export type ProductoCat = {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  imagenUrl: string | null;
};

export type ClienteCot = {
  idCliente: number;
  nombreRazonSocial: string;
  identificacionFiscal: string;
  telefono: string | null;
  correo: string | null;
};

export function CotizadorManager({
  catalogo,
  clientes,
}: {
  catalogo: ProductoCat[];
  clientes: ClienteCot[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductoCat | null>(null);

  function openPersonalizado() {
    setSelectedProduct(null);
    setModalOpen(true);
  }
  function openProduct(prod: ProductoCat) {
    setSelectedProduct(prod);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Cotización a medida */}
        <button
          onClick={openPersonalizado}
          className="group flex h-full min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface/50 p-6 text-center transition-all hover:border-brand hover:bg-surface"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-brand-soft group-hover:text-brand">
            <Plus size={32} />
          </div>
          <h3 className="mt-4 font-semibold text-ink group-hover:text-brand">Cotización a medida</h3>
          <p className="mt-1 text-xs text-muted">Para trabajos especiales que no están en el catálogo</p>
        </button>

        {/* Catálogo de productos */}
        {catalogo.map((prod) => (
          <button
            key={prod.idProducto}
            onClick={() => openProduct(prod)}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-brand"
          >
            <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-100">
              {prod.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prod.imagenUrl} alt={prod.nombre} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <PackageOpen size={48} className="text-slate-300" />
              )}
            </div>
            <div className="flex w-full flex-1 flex-col p-4">
              <h3 className="font-semibold text-ink group-hover:text-brand">{prod.nombre}</h3>
              {prod.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted">{prod.descripcion}</p>}
              <div className="mt-auto pt-4">
                <span className="text-sm font-bold text-brand">Desde {formatCurrency(prod.precioBase)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedProduct ? "Generar cotización" : "Cotización a medida"}
        description="Completa los datos para generar el PDF de la cotización."
        size="lg"
      >
        <CotizacionForm
          producto={selectedProduct}
          clientes={clientes}
          onSuccess={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
