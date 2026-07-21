"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { generateCotizacionPdf } from "@/lib/pdf-generator";
import { saveCotizacionAction } from "./actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CotizacionForm({ producto, onSuccess }: { producto: any; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imagenPersonalizada, setImagenPersonalizada] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPersonalizada(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);

      // 1. Guardar en base de datos (Server Action)
      const savedCotizacion = await saveCotizacionAction(formData);

      // 2. Generar PDF (Client Side)
      const imagenFinal = producto?.imagenUrl || imagenPersonalizada;
      await generateCotizacionPdf(savedCotizacion, imagenFinal);
      
      setSuccess(true);
      // Reset form si es personalizado o se requiere
      if (!producto) {
        (e.target as HTMLFormElement).reset();
      }
      
      // Cerrar modal opcionalmente o avisar
      if (onSuccess) {
        setTimeout(onSuccess, 1500); // 1.5s para ver el mensaje de exito
      }
    } catch (error) {
      console.error("Error al generar cotización", error);
      alert("Hubo un error al generar la cotización");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-2">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Datos del Cliente */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-ink">Datos del Cliente</h3>
              <div>
                <Label htmlFor="nombreCliente">Nombre o Razón Social *</Label>
                <input
                  id="nombreCliente"
                  name="nombreCliente"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dniRuc">DNI / RUC</Label>
                  <input
                    id="dniRuc"
                    name="dniRuc"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <input
                    id="telefono"
                    name="telefono"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="correo">Correo Electrónico</Label>
                <input
                  id="correo"
                  name="correo"
                  type="email"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {/* Datos del Producto */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-ink">Detalles del Producto</h3>
              <div>
                <Label htmlFor="producto">Producto *</Label>
                <input
                  id="producto"
                  name="producto"
                  defaultValue={producto?.nombre || ""}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <Label htmlFor="descripcion">Descripción / Especificaciones</Label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  rows={3}
                  defaultValue={producto?.descripcion || ""}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="medidas">Medidas (Ej: 2m x 1m)</Label>
                  <input
                    id="medidas"
                    name="medidas"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <Label htmlFor="tiempoEntrega">Tiempo Entrega</Label>
                  <input
                    id="tiempoEntrega"
                    name="tiempoEntrega"
                    placeholder="Ej: 7 días hábiles"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              {!producto && (
                <div className="col-span-2">
                  <Label htmlFor="imagenReferencia">Imagen de Referencia (Opcional)</Label>
                  <input
                    id="imagenReferencia"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">Costos y Cantidad</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 items-end">
              <div>
                <Label htmlFor="cantidad">Cantidad *</Label>
                <input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="precioUnitario">Precio Unitario (Referencial) *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">S/</span>
                  <input
                    id="precioUnitario"
                    name="precioUnitario"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={producto?.precioBase || ""}
                    required
                    className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="validezDias">Validez (Días)</Label>
                <input
                  id="validezDias"
                  name="validezDias"
                  type="number"
                  min="1"
                  defaultValue="7"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          {success && (
            <div className="rounded-md bg-emerald-50 p-4 text-emerald-800">
              Cotización guardada y PDF generado con éxito. Revisa tus descargas.
            </div>
          )}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Generando..." : "Generar Cotización PDF"}
        </Button>
      </div>
    </form>
  );
}
