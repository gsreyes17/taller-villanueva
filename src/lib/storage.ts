import "server-only";
import { getSupabaseAdmin, BUCKET_OBRAS } from "./supabase-admin";

export const MAX_ARCHIVO_BYTES = 15 * 1024 * 1024; // 15 MB
export const TIPOS_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

/** URL pública del objeto (el bucket `obras` es de lectura pública). */
export function publicUrlObras(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET_OBRAS}/${path}`;
}

/** Crea el bucket `obras` (público) si aún no existe. */
export async function ensureBucketObras(): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.storage.getBucket(BUCKET_OBRAS);
  if (!data) {
    await sb.storage.createBucket(BUCKET_OBRAS, {
      public: true,
      fileSizeLimit: MAX_ARCHIVO_BYTES,
      allowedMimeTypes: TIPOS_PERMITIDOS,
    });
  }
}

/** Nombre de archivo seguro para usar en la ruta del objeto. */
export function sanitizeName(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
  return (clean || "archivo").slice(-120);
}
