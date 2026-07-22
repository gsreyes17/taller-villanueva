"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatCurrency } from "@/lib/utils";
import { generateCotizacionPdf } from "@/lib/pdf-generator";
import { saveCotizacionAction } from "./actions";

type ProductoOpt = { nombre: string; descripcion?: string | null; precioBase?: number; imagenUrl?: string | null };
type ClienteOpt = {
  idCliente: number;
  nombreRazonSocial: string;
  identificacionFiscal: string;
  telefono: string | null;
  correo: string | null;
};

export function CotizacionForm({
  producto,
  clientes,
  onSuccess,
}: {
  producto?: ProductoOpt | null;
  clientes: ClienteOpt[];
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagenPersonalizada, setImagenPersonalizada] = useState<string | null>(null);

  const [idCliente, setIdCliente] = useState<string>("");
  const clienteSel = useMemo(
    () => clientes.find((c) => String(c.idCliente) === idCliente),
    [clientes, idCliente],
  );

  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState<number>(producto?.precioBase ?? 0);
  const total = Math.round(cantidad * precio * 100) / 100;

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenPersonalizada(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await saveCotizacionAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Genera el PDF con los datos ya validados por el servidor.
      const imagenFinal = producto?.imagenUrl || imagenPersonalizada;
      await generateCotizacionPdf(res.data!, imagenFinal);
      setSuccess(true);
      if (!producto) e.currentTarget.reset();
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err) {
      console.error("Error al generar cotización", err);
      setError("No se pudo generar el PDF de la cotización.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-2">
      <input type="hidden" name="idCliente" value={idCliente || "0"} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Datos del cliente */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-ink">Datos del cliente</h3>

          <Field label="Cliente registrado" hint="Elige uno para autocompletar, o escribe abajo">
            <Select value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
              <option value="">— Cliente nuevo / manual —</option>
              {clientes.map((c) => (
                <option key={c.idCliente} value={c.idCliente}>
                  {c.nombreRazonSocial} ({c.identificacionFiscal})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nombre o razón social" required>
            <Input
              name="nombreCliente"
              required
              defaultValue={clienteSel?.nombreRazonSocial ?? ""}
              key={`nom-${idCliente}`}
              placeholder="Ej: Constructora ABC S.A.C."
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="DNI / RUC">
              <Input name="dniRuc" defaultValue={clienteSel?.identificacionFiscal ?? ""} key={`doc-${idCliente}`} />
            </Field>
            <Field label="Teléfono">
              <Input name="telefono" defaultValue={clienteSel?.telefono ?? ""} key={`tel-${idCliente}`} />
            </Field>
          </div>
          <Field label="Correo electrónico">
            <Input name="correo" type="email" defaultValue={clienteSel?.correo ?? ""} key={`cor-${idCliente}`} placeholder="correo@ejemplo.com" />
          </Field>
        </div>

        {/* Datos del producto */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-ink">Detalles del producto</h3>
          <Field label="Producto" required>
            <Input name="producto" defaultValue={producto?.nombre ?? ""} required placeholder="Ej: Reja de seguridad" />
          </Field>
          <Field label="Descripción / especificaciones">
            <Textarea name="descripcion" rows={3} defaultValue={producto?.descripcion ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Medidas">
              <Input name="medidas" placeholder="Ej: 2m x 1m" />
            </Field>
            <Field label="Tiempo de entrega">
              <Input name="tiempoEntrega" placeholder="Ej: 7 días hábiles" />
            </Field>
          </div>
          {!producto && (
            <Field label="Imagen de referencia" hint="Opcional — aparece en el PDF">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </Field>
          )}
        </div>
      </div>

      {/* Costos */}
      <div className="border-t border-border pt-6">
        <h3 className="mb-4 text-base font-semibold text-ink">Costos y cantidad</h3>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
          <Field label="Cantidad" required>
            <Input
              name="cantidad"
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value) || 1)}
              required
            />
          </Field>
          <Field label="Precio unitario (S/)" required className="md:col-span-2">
            <Input
              name="precioUnitario"
              type="number"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(Number(e.target.value) || 0)}
              required
            />
          </Field>
          <Field label="Validez (días)">
            <Input name="validezDias" type="number" min="1" defaultValue="7" />
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
          <span className="text-sm font-medium text-ink">Total de la cotización</span>
          <span className="text-xl font-bold text-brand">{formatCurrency(total)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          ✓ Cotización guardada y PDF generado. Revisa tus descargas.
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Generando…" : "Generar cotización PDF"}
        </Button>
      </div>
    </form>
  );
}
