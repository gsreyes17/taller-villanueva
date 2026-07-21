"use client";

import { useState } from "react";
import { Plus, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { CotizacionForm } from "./nuevo/cotizacion-form";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CotizadorManager({ catalogo }: { catalogo: any[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const openPersonalizado = () => {
    setSelectedProduct(null);
    setModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openProduct = (prod: any) => {
    setSelectedProduct(prod);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Tarjeta para Personalizado */}
        <button
          onClick={openPersonalizado}
          className="group flex h-full min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-6 text-center transition-all hover:border-brand hover:bg-white"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-brand-soft group-hover:text-brand">
            <Plus size={32} />
          </div>
          <h3 className="mt-4 font-semibold text-ink group-hover:text-brand">Cotización a Medida</h3>
          <p className="mt-1 text-xs text-muted">Para estructuras especiales o que no están en catálogo</p>
        </button>

        {/* Tarjetas del Catálogo */}
        {catalogo.map((prod) => (
          <button
            key={prod.idProducto}
            onClick={() => openProduct(prod)}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-brand text-left"
          >
            <div className="aspect-[4/3] w-full bg-slate-100 relative flex items-center justify-center overflow-hidden">
              {prod.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prod.imagenUrl} alt={prod.nombre} className="h-full w-full object-cover" />
              ) : (
                <PackageOpen size={48} className="text-slate-300" />
              )}
            </div>
            <div className="flex flex-1 flex-col p-4 w-full">
              <h3 className="font-semibold text-ink group-hover:text-brand">{prod.nombre}</h3>
              {prod.descripcion && (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{prod.descripcion}</p>
              )}
              <div className="mt-auto pt-4">
                <span className="text-sm font-bold text-ink">
                  Desde {formatCurrency(Number(prod.precioBase))}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedProduct ? "Generar Cotización" : "Cotización a Medida"}
        description="Completa los datos para generar el PDF de la cotización."
        size="lg"
      >
        <CotizacionForm producto={selectedProduct} onSuccess={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
