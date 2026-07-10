import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_OBRAS = "obras";

let cached: SupabaseClient | null = null;

/**
 * Cliente de Supabase con la SERVICE ROLE key — SOLO servidor.
 * Se usa para Storage porque la autenticación de la app es custom (no Supabase
 * Auth), así que las operaciones de archivos pasan por el backend con permisos
 * de servicio. Nunca exponer esta key al cliente.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Storage no configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}
