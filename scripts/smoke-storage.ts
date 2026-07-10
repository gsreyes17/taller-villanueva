import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "obras";

async function main() {
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const out: string[] = [];

  // 1. Bucket
  const { data: bucket } = await sb.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"],
    });
    out.push(error ? `❌ crear bucket: ${error.message}` : "✅ bucket 'obras' creado (público)");
  } else {
    out.push("✅ bucket 'obras' ya existe");
  }

  // 2. Upload (usa el ícono como imagen de prueba)
  const bytes = readFileSync("build/icon.png");
  const path = `__smoke__/${Date.now()}-test.png`;
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  out.push(upErr ? `❌ upload: ${upErr.message}` : "✅ subida de archivo");

  // 3. URL pública accesible
  const pub = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  let status = 0;
  try {
    const res = await fetch(pub);
    status = res.status;
  } catch {
    status = -1;
  }
  out.push(status === 200 ? "✅ URL pública accesible (200)" : `❌ URL pública (${status})`);

  // 4. Delete (limpieza)
  const { error: delErr } = await sb.storage.from(BUCKET).remove([path]);
  out.push(delErr ? `❌ delete: ${delErr.message}` : "✅ archivo de prueba eliminado");

  console.log("\n=== SMOKE TEST DE STORAGE ===");
  out.forEach((l) => console.log(l));
  console.log(out.some((l) => l.startsWith("❌")) ? "\nHUBO FALLOS\n" : "\nTODO OK ✔\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
