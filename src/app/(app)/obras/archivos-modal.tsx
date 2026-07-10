"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Trash2, FileText, ExternalLink, Maximize2, X } from "lucide-react";
import { subirArchivoObra, eliminarArchivoObra } from "./actions";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type ArchivoDTO = {
  idArchivo: number;
  nombre: string;
  url: string;
  tipoMime: string | null;
  esImagen: boolean;
};

export type ObraArchivos = {
  idObra: number;
  nombreObra: string;
  archivos: ArchivoDTO[];
};

export function ArchivosModal({
  obra,
  onClose,
}: {
  obra: ObraArchivos | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [lightbox, setLightbox] = useState<ArchivoDTO | null>(null);

  // Esc cierra solo el visor a pantalla completa (no el modal de fondo).
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setLightbox(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [lightbox]);

  if (!obra) return null;

  async function subir(files: FileList | File[]) {
    if (!obra) return;
    setError(null);
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setSubiendo(true);
    for (const file of arr) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await subirArchivoObra(obra.idObra, fd);
      if (!res.ok) {
        setError(res.error);
        break;
      }
    }
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function borrar(a: ArchivoDTO) {
    if (!confirm(`¿Eliminar "${a.nombre}"?`)) return;
    const res = await eliminarArchivoObra(a.idArchivo);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <>
    <Modal open onClose={onClose} title="Bocetos y planos" description={obra.nombreObra} size="lg">
      <div className="space-y-5">
        {/* Zona de subida */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void subir(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            drag ? "border-brand bg-brand-soft" : "border-slate-300 hover:border-brand hover:bg-cream",
          )}
        >
          <UploadCloud size={32} className="text-brand" />
          <p className="mt-2 text-sm font-medium text-ink">
            Arrastra imágenes o PDF aquí, o haz clic para seleccionar
          </p>
          <p className="mt-0.5 text-xs text-muted">PNG, JPG, WEBP o PDF · máx. 15 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void subir(e.target.files)}
          />
        </div>

        {subiendo && <p className="text-sm text-brand">Subiendo archivo(s)…</p>}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {/* Galería */}
        {obra.archivos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Aún no hay bocetos.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {obra.archivos.map((a) => (
              <div
                key={a.idArchivo}
                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                {a.esImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt={a.nombre}
                    onClick={() => setLightbox(a)}
                    className="h-32 w-full cursor-zoom-in object-cover"
                  />
                ) : (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-32 w-full items-center justify-center bg-cream"
                  >
                    <FileText size={40} className="text-brand" />
                  </a>
                )}
                <p className="truncate px-2 py-1.5 text-xs text-ink" title={a.nombre}>
                  {a.nombre}
                </p>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {a.esImagen ? (
                    <button
                      onClick={() => setLightbox(a)}
                      title="Ver a pantalla completa"
                      className="rounded-md bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
                    >
                      <Maximize2 size={14} />
                    </button>
                  ) : (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir"
                      className="rounded-md bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => borrar(a)}
                    title="Eliminar"
                    className="rounded-md bg-white/90 p-1.5 text-red-500 shadow hover:bg-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>

    {/* Visor a pantalla completa (dentro de la app/web) */}
    {lightbox && (
      <div
        className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
        onClick={() => setLightbox(null)}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
          <span className="truncate text-sm font-medium">{lightbox.nombre}</span>
          <div className="flex shrink-0 gap-1">
            <a
              href={lightbox.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir en el navegador"
              className="rounded-md p-2 hover:bg-white/10"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={() => setLightbox(null)}
              title="Cerrar (Esc)"
              className="rounded-md p-2 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.nombre}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    )}
    </>
  );
}
