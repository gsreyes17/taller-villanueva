-- Referencias gráficas (bocetos/planos) de cada obra, almacenadas en Supabase Storage.
CREATE TABLE "Obra_Archivos" (
    "id_archivo"   SERIAL PRIMARY KEY,
    "id_obra"      INTEGER NOT NULL,
    "path"         VARCHAR(500) NOT NULL,
    "nombre"       VARCHAR(255) NOT NULL,
    "tipo_mime"    VARCHAR(100),
    "tamano_bytes" INTEGER,
    "subido_por"   INTEGER,
    "creado_en"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_obra_archivos_obra"    FOREIGN KEY ("id_obra")    REFERENCES "Obras"("id_obra")       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "fk_obra_archivos_usuario" FOREIGN KEY ("subido_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_obra_archivos_obra" ON "Obra_Archivos"("id_obra");

ALTER TABLE "Obra_Archivos" ENABLE ROW LEVEL SECURITY;
