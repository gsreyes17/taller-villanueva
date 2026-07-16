-- =====================================================================
-- MODELO v2 — Rigor operativo del taller
--   1. Catálogos: Categorias (jerárquicas), Unidades_Medida, Ubicaciones
--   2. Proveedores + Compras/Detalle_Compra (costo real con IGV y flete)
--   3. Costeo real de obra: Mano_Obra_Obra, Costos_Indirectos_Obra
--   4. Materiales: atributos técnicos + FK a catálogos + merma por material
--   5. Presupuestos: subtotal / IGV / moneda
--   6. Triggers: merma efectiva por material, CUPP desde compras recibidas
--
-- IMPORTANTE: migra los datos existentes (categoría/unidad en texto libre)
-- a los nuevos catálogos SIN pérdida de información.
-- =====================================================================

-- ------------------------------ ENUMS --------------------------------
CREATE TYPE "tipo_unidad"          AS ENUM ('Longitud', 'Masa', 'Area', 'Volumen', 'Unidad');
CREATE TYPE "estado_compra"        AS ENUM ('Borrador', 'Confirmada', 'Recibida', 'Anulada');
CREATE TYPE "tipo_costo_indirecto" AS ENUM ('Energia', 'Transporte', 'Equipos', 'Consumibles', 'Subcontrato', 'Otro');

-- --------------------------- 1. CATÁLOGOS ----------------------------
CREATE TABLE "Categorias" (
    "id_categoria"       SERIAL PRIMARY KEY,
    "nombre"             VARCHAR(80) NOT NULL,
    "descripcion"        VARCHAR(255),
    "id_categoria_padre" INTEGER,
    "porcentaje_merma"   DECIMAL(5,2) NOT NULL DEFAULT 6.00,
    "estado"             "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    "creado_en"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_categorias_padre" FOREIGN KEY ("id_categoria_padre") REFERENCES "Categorias"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_categorias_merma" CHECK ("porcentaje_merma" >= 0 AND "porcentaje_merma" <= 100),
    -- Una categoría no puede ser su propio padre.
    CONSTRAINT "chk_categorias_no_autopadre" CHECK ("id_categoria_padre" IS NULL OR "id_categoria_padre" <> "id_categoria")
);
CREATE UNIQUE INDEX "uq_categoria_nombre_padre" ON "Categorias"("nombre", "id_categoria_padre");
CREATE INDEX "idx_categorias_padre" ON "Categorias"("id_categoria_padre");

CREATE TABLE "Unidades_Medida" (
    "id_unidad"   SERIAL PRIMARY KEY,
    "simbolo"     VARCHAR(10) NOT NULL,
    "nombre"      VARCHAR(50) NOT NULL,
    "tipo"        "tipo_unidad" NOT NULL,
    "factor_base" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "estado"      "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    CONSTRAINT "uq_unidades_simbolo" UNIQUE ("simbolo"),
    CONSTRAINT "chk_unidades_factor" CHECK ("factor_base" > 0)
);

CREATE TABLE "Ubicaciones" (
    "id_ubicacion"  SERIAL PRIMARY KEY,
    "zona"          VARCHAR(50) NOT NULL,
    "estante"       VARCHAR(50),
    "nivel"         VARCHAR(50),
    "descripcion"   VARCHAR(255),
    "capacidad_max" DECIMAL(10,2),
    "estado"        "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    "creado_en"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "chk_ubicaciones_capacidad" CHECK ("capacidad_max" IS NULL OR "capacidad_max" > 0)
);
-- NULLS NOT DISTINCT: evita duplicar (Zona A, NULL, NULL) dos veces.
CREATE UNIQUE INDEX "uq_ubicacion_zona_estante_nivel" ON "Ubicaciones"("zona", "estante", "nivel") NULLS NOT DISTINCT;
CREATE INDEX "idx_ubicaciones_zona" ON "Ubicaciones"("zona");

CREATE TABLE "Proveedores" (
    "id_proveedor"    SERIAL PRIMARY KEY,
    "ruc"             VARCHAR(20) NOT NULL,
    "razon_social"    VARCHAR(150) NOT NULL,
    "direccion"       VARCHAR(255),
    "telefono"        VARCHAR(20),
    "correo"          VARCHAR(100),
    "contacto_nombre" VARCHAR(150),
    "dias_credito"    INTEGER NOT NULL DEFAULT 0,
    "estado"          "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    "creado_en"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "creado_por"      INTEGER,
    CONSTRAINT "uq_proveedores_ruc" UNIQUE ("ruc"),
    CONSTRAINT "fk_proveedores_creado_por" FOREIGN KEY ("creado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_proveedores_credito" CHECK ("dias_credito" >= 0)
);
CREATE INDEX "idx_proveedores_estado" ON "Proveedores"("estado");

-- ------------------ 2. SEMBRAR CATÁLOGOS BASE ------------------------
-- Unidades de medida del rubro (factor respecto a la base de su tipo).
INSERT INTO "Unidades_Medida" ("simbolo", "nombre", "tipo", "factor_base") VALUES
    ('m',      'Metro',            'Longitud', 1),
    ('cm',     'Centímetro',       'Longitud', 0.01),
    ('mm',     'Milímetro',        'Longitud', 0.001),
    ('pulg',   'Pulgada',          'Longitud', 0.0254),
    ('kg',     'Kilogramo',        'Masa',     1),
    ('t',      'Tonelada',         'Masa',     1000),
    ('m2',     'Metro cuadrado',   'Area',     1),
    ('m3',     'Metro cúbico',     'Volumen',  1),
    ('gal',    'Galón',            'Volumen',  0.003785),
    ('und',    'Unidad',           'Unidad',   1),
    ('pln',    'Plancha',          'Unidad',   1),
    ('var',    'Varilla',          'Unidad',   1),
    ('jgo',    'Juego',            'Unidad',   1);

-- Categorías raíz del dominio metalmecánico.
INSERT INTO "Categorias" ("nombre", "descripcion", "porcentaje_merma") VALUES
    ('Acero estructural', 'Perfiles, planchas y tubos de acero',          6.00),
    ('Consumibles',       'Soldadura, discos, gases y afines',            3.00),
    ('Fijaciones',        'Pernos, tuercas, anclajes y tornillería',      2.00),
    ('Acabados',          'Pinturas, solventes y recubrimientos',         5.00);

-- Subcategorías (heredan del padre, con merma propia según el corte real).
INSERT INTO "Categorias" ("nombre", "descripcion", "id_categoria_padre", "porcentaje_merma")
SELECT v.nombre, v.descripcion, c."id_categoria", v.merma
FROM (VALUES
    ('Perfiles',   'Perfiles C, L, T, H, U',          'Acero estructural', 6.00),
    ('Planchas',   'Planchas LAC, LAF, estriadas',    'Acero estructural', 12.00),
    ('Tubos',      'Tubos cuadrados, rectangulares y redondos', 'Acero estructural', 6.00),
    ('Barras',     'Barras lisas y corrugadas',       'Acero estructural', 5.00),
    ('Soldadura',  'Electrodos y alambres MIG/TIG',   'Consumibles',       3.00),
    ('Abrasivos',  'Discos de corte y desbaste',      'Consumibles',       2.00),
    ('Gases',      'Oxígeno, argón, CO2',             'Consumibles',       1.00),
    ('Pernería',   'Pernos, tuercas y arandelas',     'Fijaciones',        2.00),
    ('Pinturas',   'Base, esmalte y anticorrosivos',  'Acabados',          5.00)
) AS v(nombre, descripcion, padre, merma)
JOIN "Categorias" c ON c."nombre" = v.padre AND c."id_categoria_padre" IS NULL;

-- Zonas de almacenamiento del local.
INSERT INTO "Ubicaciones" ("zona", "estante", "nivel", "descripcion") VALUES
    ('Zona A', 'Rack 1', 'Nivel 1', 'Perfiles largos — acceso con puente grúa'),
    ('Zona A', 'Rack 1', 'Nivel 2', 'Perfiles medianos'),
    ('Zona A', 'Rack 2', 'Nivel 1', 'Tubos estructurales'),
    ('Zona B', 'Caballete 1', NULL,  'Planchas en horizontal'),
    ('Zona B', 'Caballete 2', NULL,  'Planchas de gran formato'),
    ('Zona C', 'Anaquel 1', 'Nivel 1', 'Consumibles de soldadura (ambiente seco)'),
    ('Zona C', 'Anaquel 1', 'Nivel 2', 'Discos y abrasivos'),
    ('Zona C', 'Anaquel 2', 'Nivel 1', 'Pernería y fijaciones'),
    ('Zona D', 'Gabinete 1', NULL,  'Pinturas y solventes (área ventilada)'),
    ('Zona E', NULL, NULL, 'Patio — recepción y material pendiente de clasificar');

-- ------------------ 3. MATERIALES: nuevas columnas -------------------
ALTER TABLE "Materiales"
    ADD COLUMN "id_categoria"     INTEGER,
    ADD COLUMN "id_unidad"        INTEGER,
    ADD COLUMN "id_ubicacion"     INTEGER,
    ADD COLUMN "norma"            VARCHAR(50),
    ADD COLUMN "espesor_mm"       DECIMAL(8,2),
    ADD COLUMN "medidas"          VARCHAR(80),
    ADD COLUMN "acabado"          VARCHAR(50),
    ADD COLUMN "peso_unitario"    DECIMAL(10,3),
    ADD COLUMN "porcentaje_merma" DECIMAL(5,2);

-- BACKFILL: mapear el texto libre existente a los catálogos nuevos.
-- 3.1 Categoría: por nombre exacto de la subcategoría; si no existe, se crea
--     bajo "Acero estructural" para no perder el dato del usuario.
INSERT INTO "Categorias" ("nombre", "descripcion", "id_categoria_padre", "porcentaje_merma")
SELECT DISTINCT m."categoria", 'Migrada automáticamente desde el modelo v1',
       (SELECT "id_categoria" FROM "Categorias" WHERE "nombre" = 'Acero estructural' AND "id_categoria_padre" IS NULL),
       6.00
FROM "Materiales" m
WHERE m."categoria" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Categorias" c WHERE c."nombre" = m."categoria");

UPDATE "Materiales" m
SET "id_categoria" = c."id_categoria"
FROM "Categorias" c
WHERE c."nombre" = m."categoria";

-- 3.2 Unidad: mapear los textos usados en v1 a los símbolos del catálogo.
UPDATE "Materiales" m
SET "id_unidad" = u."id_unidad"
FROM "Unidades_Medida" u
WHERE u."simbolo" = CASE lower(trim(m."unidad_medida"))
    WHEN 'metro'   THEN 'm'
    WHEN 'metros'  THEN 'm'
    WHEN 'm'       THEN 'm'
    WHEN 'kg'      THEN 'kg'
    WHEN 'kilogramo' THEN 'kg'
    WHEN 'unidad'  THEN 'und'
    WHEN 'und'     THEN 'und'
    WHEN 'plancha' THEN 'pln'
    WHEN 'galon'   THEN 'gal'
    WHEN 'galón'   THEN 'gal'
    ELSE 'und'  -- fallback seguro
END;

-- 3.3 Ubicación: si v1 tenía texto en area_almacen, ubicarlo; si no, al patio.
UPDATE "Materiales" m
SET "id_ubicacion" = COALESCE(
    (SELECT ub."id_ubicacion" FROM "Ubicaciones" ub
      WHERE ub."zona" = m."area_almacen"
        AND ub."estante" IS NOT DISTINCT FROM m."estante_nivel"
      LIMIT 1),
    (SELECT ub."id_ubicacion" FROM "Ubicaciones" ub WHERE ub."zona" = 'Zona E' LIMIT 1)
);

-- Ahora que todo está poblado, exigir las FK.
ALTER TABLE "Materiales"
    ALTER COLUMN "id_categoria" SET NOT NULL,
    ALTER COLUMN "id_unidad"    SET NOT NULL;

ALTER TABLE "Materiales"
    ADD CONSTRAINT "fk_materiales_categoria" FOREIGN KEY ("id_categoria") REFERENCES "Categorias"("id_categoria")     ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "fk_materiales_unidad"    FOREIGN KEY ("id_unidad")    REFERENCES "Unidades_Medida"("id_unidad")   ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "fk_materiales_ubicacion" FOREIGN KEY ("id_ubicacion") REFERENCES "Ubicaciones"("id_ubicacion")    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "chk_materiales_merma"   CHECK ("porcentaje_merma" IS NULL OR ("porcentaje_merma" >= 0 AND "porcentaje_merma" <= 100)),
    ADD CONSTRAINT "chk_materiales_espesor" CHECK ("espesor_mm" IS NULL OR "espesor_mm" > 0),
    ADD CONSTRAINT "chk_materiales_peso"    CHECK ("peso_unitario" IS NULL OR "peso_unitario" > 0);

-- Las columnas de texto libre v1 ya cumplieron su función.
ALTER TABLE "Materiales"
    DROP COLUMN "categoria",
    DROP COLUMN "unidad_medida",
    DROP COLUMN "area_almacen",
    DROP COLUMN "estante_nivel";

CREATE INDEX "idx_materiales_categoria_fk" ON "Materiales"("id_categoria");
CREATE INDEX "idx_materiales_ubicacion"    ON "Materiales"("id_ubicacion");
CREATE INDEX "idx_materiales_estado"       ON "Materiales"("estado");

-- ------------------ 4. PRESUPUESTOS: IGV y moneda --------------------
ALTER TABLE "Presupuestos"
    ADD COLUMN "subtotal"       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN "igv_porcentaje" DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
    ADD COLUMN "igv_monto"      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN "moneda"         VARCHAR(3)    NOT NULL DEFAULT 'PEN',
    ADD CONSTRAINT "chk_presupuestos_igv" CHECK ("igv_porcentaje" >= 0 AND "igv_porcentaje" <= 100),
    ADD CONSTRAINT "chk_presupuestos_subtotal" CHECK ("subtotal" >= 0 AND "igv_monto" >= 0);

-- Los presupuestos v1 tenían monto_total ya "cerrado": se interpreta como
-- subtotal y se recalcula el IGV para dejarlos consistentes con el modelo v2.
UPDATE "Presupuestos"
SET "subtotal"  = "monto_total",
    "igv_monto" = ROUND("monto_total" * 0.18, 2),
    "monto_total" = ROUND("monto_total" * 1.18, 2)
WHERE "subtotal" = 0 AND "monto_total" > 0;

-- --------------------------- 5. COMPRAS ------------------------------
CREATE TABLE "Compras" (
    "id_compra"       SERIAL PRIMARY KEY,
    "id_proveedor"    INTEGER NOT NULL,
    "numero_documento" VARCHAR(50) NOT NULL,
    "fecha_emision"   DATE NOT NULL,
    "fecha_recepcion" DATE,
    "estado"          "estado_compra" NOT NULL DEFAULT 'Borrador',
    "subtotal"        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "flete"           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "igv_porcentaje"  DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
    "igv_monto"       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total"           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "moneda"          VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "observaciones"   VARCHAR(255),
    "creado_en"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "creado_por"      INTEGER,
    CONSTRAINT "uq_compra_proveedor_documento" UNIQUE ("id_proveedor", "numero_documento"),
    CONSTRAINT "fk_compras_proveedor"  FOREIGN KEY ("id_proveedor") REFERENCES "Proveedores"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_compras_creado_por" FOREIGN KEY ("creado_por")   REFERENCES "Usuarios"("id_usuario")      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_compras_montos" CHECK ("subtotal" >= 0 AND "flete" >= 0 AND "igv_monto" >= 0 AND "total" >= 0),
    -- No se puede recibir antes de emitir.
    CONSTRAINT "chk_compras_fechas" CHECK ("fecha_recepcion" IS NULL OR "fecha_recepcion" >= "fecha_emision")
);
CREATE INDEX "idx_compras_fecha"  ON "Compras"("fecha_emision");
CREATE INDEX "idx_compras_estado" ON "Compras"("estado");

CREATE TABLE "Detalle_Compra" (
    "id_detalle_compra" SERIAL PRIMARY KEY,
    "id_compra"         INTEGER NOT NULL,
    "id_material"       INTEGER NOT NULL,
    "cantidad"          DECIMAL(10,2) NOT NULL,
    "costo_unitario"    DECIMAL(10,2) NOT NULL,
    "flete_prorrateado" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "uq_detalle_compra_material" UNIQUE ("id_compra", "id_material"),
    CONSTRAINT "fk_detalle_compra_compra"   FOREIGN KEY ("id_compra")   REFERENCES "Compras"("id_compra")     ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "fk_detalle_compra_material" FOREIGN KEY ("id_material") REFERENCES "Materiales"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_detalle_compra_cantidad" CHECK ("cantidad" > 0),
    CONSTRAINT "chk_detalle_compra_costo"    CHECK ("costo_unitario" >= 0 AND "flete_prorrateado" >= 0)
);
CREATE INDEX "idx_detalle_compra_material" ON "Detalle_Compra"("id_material");

-- Trazabilidad: cada entrada del kardex apunta a la compra que la originó.
ALTER TABLE "Movimientos_Inventario"
    ADD COLUMN "id_compra" INTEGER,
    ADD CONSTRAINT "fk_movimientos_compra" FOREIGN KEY ("id_compra") REFERENCES "Compras"("id_compra") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_movimientos_compra" ON "Movimientos_Inventario"("id_compra");

-- ---------------------- 6. COSTEO REAL DE OBRA -----------------------
CREATE TABLE "Mano_Obra_Obra" (
    "id_mano_obra" SERIAL PRIMARY KEY,
    "id_obra"      INTEGER NOT NULL,
    "id_usuario"   INTEGER,
    "descripcion"  VARCHAR(255),
    "fecha"        DATE NOT NULL,
    "horas"        DECIMAL(6,2) NOT NULL,
    "tarifa_hora"  DECIMAL(10,2) NOT NULL,
    "creado_en"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_mano_obra_obra"    FOREIGN KEY ("id_obra")    REFERENCES "Obras"("id_obra")       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "fk_mano_obra_usuario" FOREIGN KEY ("id_usuario") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_mano_obra_horas"  CHECK ("horas" > 0 AND "horas" <= 24),
    CONSTRAINT "chk_mano_obra_tarifa" CHECK ("tarifa_hora" >= 0)
);
CREATE INDEX "idx_mano_obra_obra"  ON "Mano_Obra_Obra"("id_obra");
CREATE INDEX "idx_mano_obra_fecha" ON "Mano_Obra_Obra"("fecha");

CREATE TABLE "Costos_Indirectos_Obra" (
    "id_costo_indirecto" SERIAL PRIMARY KEY,
    "id_obra"            INTEGER NOT NULL,
    "tipo"               "tipo_costo_indirecto" NOT NULL,
    "descripcion"        VARCHAR(255),
    "monto"              DECIMAL(12,2) NOT NULL,
    "fecha"              DATE NOT NULL,
    "registrado_por"     INTEGER,
    "creado_en"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_costos_ind_obra"    FOREIGN KEY ("id_obra")        REFERENCES "Obras"("id_obra")       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "fk_costos_ind_usuario" FOREIGN KEY ("registrado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_costos_ind_monto"  CHECK ("monto" > 0)
);
CREATE INDEX "idx_costos_ind_obra"  ON "Costos_Indirectos_Obra"("id_obra");
CREATE INDEX "idx_costos_ind_fecha" ON "Costos_Indirectos_Obra"("fecha");

-- =====================================================================
-- 7. TRIGGERS v2
-- =====================================================================

-- 7.1 Merma efectiva: material.porcentaje_merma → si NULL, hereda categoría.
--     Reemplaza el 6% fijo del modelo v1.
CREATE OR REPLACE FUNCTION fn_merma_efectiva(p_id_material INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    v_merma DECIMAL(5,2);
BEGIN
    SELECT COALESCE(m."porcentaje_merma", c."porcentaje_merma", 6.00)
      INTO v_merma
      FROM "Materiales" m
      JOIN "Categorias" c ON c."id_categoria" = m."id_categoria"
     WHERE m."id_material" = p_id_material;
    RETURN COALESCE(v_merma, 6.00);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7.2 Presupuesto: la merma pasa a ser PONDERADA según los materiales del
--     detalle (cada uno con su % real), en vez de un 6% plano.
CREATE OR REPLACE FUNCTION fn_presupuesto_recalcular(p_id_presupuesto INTEGER)
RETURNS VOID AS $$
DECLARE
    v_base    DECIMAL(12,2);
    v_mermas  DECIMAL(12,2);
    v_mano    DECIMAL(12,2);
    v_margen  DECIMAL(5,2);
    v_igv_pct DECIMAL(5,2);
    v_subtotal DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(d."cantidad_requerida" * d."precio_unitario_momento"), 0),
           COALESCE(SUM(d."cantidad_requerida" * d."precio_unitario_momento"
                        * fn_merma_efectiva(d."id_material") / 100.0), 0)
      INTO v_base, v_mermas
      FROM "Detalle_Presupuesto" d
     WHERE d."id_presupuesto" = p_id_presupuesto;

    SELECT "costo_mano_obra", "margen_ganancia_porcentaje", "igv_porcentaje"
      INTO v_mano, v_margen, v_igv_pct
      FROM "Presupuestos" WHERE "id_presupuesto" = p_id_presupuesto;

    v_subtotal := ROUND((v_base + v_mermas + COALESCE(v_mano, 0)) * (1 + COALESCE(v_margen, 0) / 100.0), 2);

    UPDATE "Presupuestos"
       SET "costo_materiales_base" = ROUND(v_base, 2),
           "costo_mermas"          = ROUND(v_mermas, 2),
           "subtotal"              = v_subtotal,
           "igv_monto"             = ROUND(v_subtotal * COALESCE(v_igv_pct, 18) / 100.0, 2),
           "monto_total"           = ROUND(v_subtotal * (1 + COALESCE(v_igv_pct, 18) / 100.0), 2),
           "actualizado_en"        = now()
     WHERE "id_presupuesto" = p_id_presupuesto;
END;
$$ LANGUAGE plpgsql;

-- Al tocar el detalle, el presupuesto se recalcula solo (integridad garantizada).
CREATE OR REPLACE FUNCTION fn_detalle_presupuesto_recalc()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM fn_presupuesto_recalcular(COALESCE(NEW."id_presupuesto", OLD."id_presupuesto"));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_presupuesto_recalc
    AFTER INSERT OR UPDATE OR DELETE ON "Detalle_Presupuesto"
    FOR EACH ROW EXECUTE FUNCTION fn_detalle_presupuesto_recalc();

-- El trigger v1 de mermas 6% plano queda obsoleto.
DROP TRIGGER IF EXISTS trg_presupuestos_mermas ON "Presupuestos";
DROP FUNCTION IF EXISTS fn_presupuestos_mermas();

-- 7.3 CUPP automático: al recibir una compra, el costo real de adquisición
--     (costo unitario + flete prorrateado) recalcula el promedio ponderado.
CREATE OR REPLACE FUNCTION fn_compra_recibida()
RETURNS TRIGGER AS $$
DECLARE
    d RECORD;
    v_stock_previo   DECIMAL(10,2);
    v_cupp_previo    DECIMAL(10,2);
    v_costo_real     DECIMAL(10,2);
    v_nuevo_cupp     DECIMAL(10,2);
BEGIN
    -- Solo al pasar a 'Recibida' (transición, no en cada update).
    IF NEW."estado" <> 'Recibida' OR OLD."estado" = 'Recibida' THEN
        RETURN NEW;
    END IF;

    FOR d IN SELECT * FROM "Detalle_Compra" WHERE "id_compra" = NEW."id_compra" LOOP
        SELECT "stock_actual", "cupp" INTO v_stock_previo, v_cupp_previo
          FROM "Materiales" WHERE "id_material" = d."id_material" FOR UPDATE;

        -- Costo real de adquisición unitario = precio + flete prorrateado.
        v_costo_real := d."costo_unitario" + (d."flete_prorrateado" / NULLIF(d."cantidad", 0));

        -- Promedio ponderado: (stock*cupp + cantidad*costo) / (stock+cantidad)
        v_nuevo_cupp := ROUND(
            ((v_stock_previo * v_cupp_previo) + (d."cantidad" * v_costo_real))
            / NULLIF(v_stock_previo + d."cantidad", 0), 2);

        -- La entrada al kardex dispara los triggers de stock ya existentes.
        INSERT INTO "Movimientos_Inventario"
            ("id_material", "tipo_movimiento", "cantidad", "saldo_resultante",
             "costo_unitario", "motivo", "referencia_documento", "id_compra",
             "id_usuario", "fecha_movimiento")
        VALUES (d."id_material", 'Entrada', d."cantidad", 0, v_costo_real,
                'Recepción de compra', NEW."numero_documento", NEW."id_compra",
                COALESCE(NEW."creado_por", (SELECT "id_usuario" FROM "Usuarios" ORDER BY "id_usuario" LIMIT 1)),
                COALESCE(NEW."fecha_recepcion", CURRENT_DATE));

        UPDATE "Materiales"
           SET "cupp" = COALESCE(v_nuevo_cupp, v_cupp_previo), "actualizado_en" = now()
         WHERE "id_material" = d."id_material";
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_recibida
    AFTER UPDATE OF "estado" ON "Compras"
    FOR EACH ROW EXECUTE FUNCTION fn_compra_recibida();

-- 7.4 Totales de la compra siempre consistentes con su detalle.
CREATE OR REPLACE FUNCTION fn_compra_recalcular()
RETURNS TRIGGER AS $$
DECLARE
    v_id     INTEGER := COALESCE(NEW."id_compra", OLD."id_compra");
    v_sub    DECIMAL(12,2);
    v_flete  DECIMAL(12,2);
    v_igvpct DECIMAL(5,2);
BEGIN
    SELECT COALESCE(SUM("cantidad" * "costo_unitario"), 0) INTO v_sub
      FROM "Detalle_Compra" WHERE "id_compra" = v_id;
    SELECT "flete", "igv_porcentaje" INTO v_flete, v_igvpct
      FROM "Compras" WHERE "id_compra" = v_id;

    UPDATE "Compras"
       SET "subtotal"  = ROUND(v_sub, 2),
           "igv_monto" = ROUND((v_sub + COALESCE(v_flete,0)) * COALESCE(v_igvpct,18) / 100.0, 2),
           "total"     = ROUND((v_sub + COALESCE(v_flete,0)) * (1 + COALESCE(v_igvpct,18) / 100.0), 2),
           "actualizado_en" = now()
     WHERE "id_compra" = v_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_compra_recalc
    AFTER INSERT OR UPDATE OR DELETE ON "Detalle_Compra"
    FOR EACH ROW EXECUTE FUNCTION fn_compra_recalcular();

-- =====================================================================
-- 8. VISTAS v2
-- =====================================================================

-- Rentabilidad real por obra: presupuestado vs costo real incurrido.
CREATE OR REPLACE VIEW "v_rentabilidad_obras" AS
SELECT
    o."id_obra",
    o."nombre_obra",
    c."nombre_razon_social",
    o."estado_obra",
    COALESCE(p."monto_total", 0)                        AS "monto_presupuestado",
    COALESCE(mat."costo_materiales_real", 0)            AS "costo_materiales_real",
    COALESCE(mo."costo_mano_obra_real", 0)              AS "costo_mano_obra_real",
    COALESCE(ci."costos_indirectos_real", 0)            AS "costos_indirectos_real",
    COALESCE(mat."costo_materiales_real", 0) + COALESCE(mo."costo_mano_obra_real", 0)
        + COALESCE(ci."costos_indirectos_real", 0)      AS "costo_total_real",
    COALESCE(p."monto_total", 0)
        - (COALESCE(mat."costo_materiales_real", 0) + COALESCE(mo."costo_mano_obra_real", 0)
           + COALESCE(ci."costos_indirectos_real", 0))  AS "margen_real",
    COALESCE(pg."total_cobrado", 0)                     AS "total_cobrado"
FROM "Obras" o
JOIN "Clientes" c ON c."id_cliente" = o."id_cliente"
LEFT JOIN "Presupuestos" p ON p."id_obra" = o."id_obra"
LEFT JOIN (
    SELECT "id_obra", SUM("cantidad" * "costo_unitario") AS "costo_materiales_real"
    FROM "Movimientos_Inventario"
    WHERE "tipo_movimiento" = 'Salida' AND "id_obra" IS NOT NULL
    GROUP BY "id_obra"
) mat ON mat."id_obra" = o."id_obra"
LEFT JOIN (
    SELECT "id_obra", SUM("horas" * "tarifa_hora") AS "costo_mano_obra_real"
    FROM "Mano_Obra_Obra" GROUP BY "id_obra"
) mo ON mo."id_obra" = o."id_obra"
LEFT JOIN (
    SELECT "id_obra", SUM("monto") AS "costos_indirectos_real"
    FROM "Costos_Indirectos_Obra" GROUP BY "id_obra"
) ci ON ci."id_obra" = o."id_obra"
LEFT JOIN (
    SELECT "id_obra", SUM("monto_abonado") AS "total_cobrado"
    FROM "Pagos_Obras" GROUP BY "id_obra"
) pg ON pg."id_obra" = o."id_obra";

-- Inventario con su clasificación y ubicación física resueltas.
CREATE OR REPLACE VIEW "v_inventario_ubicado" AS
SELECT
    m."id_material",
    m."codigo_material",
    m."nombre",
    cat."nombre"        AS "categoria",
    padre."nombre"      AS "categoria_padre",
    u."simbolo"         AS "unidad",
    ub."zona", ub."estante", ub."nivel",
    m."stock_actual", m."stock_minimo", m."cupp",
    ROUND(m."stock_actual" * m."cupp", 2) AS "valorizacion",
    (m."stock_actual" <= m."stock_minimo") AS "bajo_stock",
    m."estado"
FROM "Materiales" m
JOIN "Categorias" cat      ON cat."id_categoria" = m."id_categoria"
LEFT JOIN "Categorias" padre ON padre."id_categoria" = cat."id_categoria_padre"
JOIN "Unidades_Medida" u   ON u."id_unidad" = m."id_unidad"
LEFT JOIN "Ubicaciones" ub ON ub."id_ubicacion" = m."id_ubicacion";

-- =====================================================================
-- 9. RLS en las tablas nuevas (coherente con el resto del modelo)
-- =====================================================================
ALTER TABLE "Categorias"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unidades_Medida"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ubicaciones"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proveedores"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Compras"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Detalle_Compra"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mano_Obra_Obra"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Costos_Indirectos_Obra" ENABLE ROW LEVEL SECURITY;
