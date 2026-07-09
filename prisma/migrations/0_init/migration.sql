-- =====================================================================
-- Taller Villanueva — Migración inicial (Postgres / Supabase)
-- Traducida desde bd_taller_villanueva_v2.sql (MySQL).
-- Incluye: enums, tablas, índices, CHECKs, triggers (plpgsql), vistas y RLS.
-- =====================================================================

-- ------------------------------- ENUMS -------------------------------
CREATE TYPE "rol_usuario"            AS ENUM ('Administrador', 'Trabajador');
CREATE TYPE "estado_activo_inactivo" AS ENUM ('Activo', 'Inactivo');
CREATE TYPE "tipo_cliente"           AS ENUM ('Persona Natural', 'Empresa');
CREATE TYPE "estado_material"        AS ENUM ('Activo', 'Descontinuado');
CREATE TYPE "estado_obra"            AS ENUM ('Presupuestando', 'En Ejecución', 'Finalizado', 'Cancelado');
CREATE TYPE "tipo_movimiento"        AS ENUM ('Entrada', 'Salida', 'Ajuste');
CREATE TYPE "tipo_pago"              AS ENUM ('Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro');
CREATE TYPE "accion_auditoria"       AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ----------------------------- 1. USUARIOS ---------------------------
CREATE TABLE "Usuarios" (
    "id_usuario"        SERIAL PRIMARY KEY,
    "nombre_usuario"    VARCHAR(50)  NOT NULL,
    "nombre"            VARCHAR(50)  NOT NULL,
    "apellido"          VARCHAR(50)  NOT NULL,
    "correo"            VARCHAR(100),
    "contrasena_hash"   VARCHAR(255) NOT NULL,
    "rol"               "rol_usuario" NOT NULL,
    "estado"            "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta"   TIMESTAMPTZ,
    "ultimo_acceso"     TIMESTAMPTZ,
    "creado_en"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "uq_usuarios_nombre_usuario" UNIQUE ("nombre_usuario"),
    CONSTRAINT "uq_usuarios_correo"         UNIQUE ("correo"),
    CONSTRAINT "chk_usuarios_correo" CHECK ("correo" IS NULL OR "correo" LIKE '%_@__%.__%')
);

-- ----------------------------- 2. CLIENTES ---------------------------
CREATE TABLE "Clientes" (
    "id_cliente"            SERIAL PRIMARY KEY,
    "tipo_cliente"          "tipo_cliente" NOT NULL,
    "identificacion_fiscal" VARCHAR(20) NOT NULL,
    "nombre_razon_social"   VARCHAR(150) NOT NULL,
    "direccion"             VARCHAR(255) NOT NULL,
    "telefono"              VARCHAR(20)  NOT NULL,
    "correo"                VARCHAR(100),
    "estado"                "estado_activo_inactivo" NOT NULL DEFAULT 'Activo',
    "distrito"              VARCHAR(100),
    "telefono_secundario"   VARCHAR(20),
    "correo_secundario"     VARCHAR(100),
    "contacto_nombre"       VARCHAR(150),
    "contacto_cargo"        VARCHAR(100),
    "creado_en"             TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "creado_por"            INTEGER,
    "actualizado_por"       INTEGER,
    CONSTRAINT "uq_clientes_identificacion" UNIQUE ("identificacion_fiscal"),
    CONSTRAINT "fk_clientes_creado_por"      FOREIGN KEY ("creado_por")      REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_clientes_actualizado_por" FOREIGN KEY ("actualizado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_clientes_estado" ON "Clientes"("estado");

-- ----------------------------- 3. MATERIALES -------------------------
CREATE TABLE "Materiales" (
    "id_material"     SERIAL PRIMARY KEY,
    "codigo_material" VARCHAR(50)  NOT NULL,
    "nombre"          VARCHAR(100) NOT NULL,
    "descripcion"     VARCHAR(255),
    "categoria"       VARCHAR(50)  NOT NULL,
    "unidad_medida"   VARCHAR(20)  NOT NULL,
    "stock_actual"    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "stock_minimo"    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "stock_maximo"    DECIMAL(10,2),
    "cupp"            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "area_almacen"    VARCHAR(50),
    "estante_nivel"   VARCHAR(50),
    "estado"          "estado_material" NOT NULL DEFAULT 'Activo',
    "creado_en"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "uq_materiales_codigo" UNIQUE ("codigo_material"),
    CONSTRAINT "chk_materiales_stock_actual" CHECK ("stock_actual" >= 0),
    CONSTRAINT "chk_materiales_stock_minimo" CHECK ("stock_minimo" >= 0),
    CONSTRAINT "chk_materiales_stock_maximo" CHECK ("stock_maximo" IS NULL OR "stock_maximo" >= "stock_minimo"),
    CONSTRAINT "chk_materiales_cupp"         CHECK ("cupp" >= 0)
);
CREATE INDEX "idx_materiales_categoria" ON "Materiales"("categoria");

-- ----------------------------- 4. OBRAS ------------------------------
CREATE TABLE "Obras" (
    "id_obra"                 SERIAL PRIMARY KEY,
    "id_cliente"              INTEGER NOT NULL,
    "nombre_obra"             VARCHAR(150) NOT NULL,
    "descripcion"             TEXT,
    "tipo_obra"               VARCHAR(100),
    "ubicacion"               VARCHAR(255),
    "fecha_inicio"            DATE NOT NULL,
    "fecha_entrega_estimada"  DATE NOT NULL,
    "fecha_entrega_real"      DATE,
    "porcentaje_avance"       DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "estado_obra"             "estado_obra" NOT NULL DEFAULT 'Presupuestando',
    "creado_en"               TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "creado_por"              INTEGER,
    "actualizado_por"         INTEGER,
    CONSTRAINT "fk_obras_cliente"         FOREIGN KEY ("id_cliente")      REFERENCES "Clientes"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_obras_creado_por"      FOREIGN KEY ("creado_por")      REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_obras_actualizado_por" FOREIGN KEY ("actualizado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_obras_avance" CHECK ("porcentaje_avance" BETWEEN 0 AND 100),
    CONSTRAINT "chk_obras_fechas" CHECK ("fecha_entrega_estimada" >= "fecha_inicio")
);
CREATE INDEX "idx_obras_cliente" ON "Obras"("id_cliente");
CREATE INDEX "idx_obras_estado"  ON "Obras"("estado_obra");

-- ----------------------------- 5. PRESUPUESTOS -----------------------
CREATE TABLE "Presupuestos" (
    "id_presupuesto"             SERIAL PRIMARY KEY,
    "id_obra"                    INTEGER NOT NULL,
    "costo_mano_obra"            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "costo_materiales_base"      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "costo_mermas"               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "margen_ganancia_porcentaje" DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    "monto_total"                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "fecha_creacion"             DATE NOT NULL,
    "creado_en"                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en"             TIMESTAMPTZ NOT NULL DEFAULT now(),
    "creado_por"                 INTEGER,
    CONSTRAINT "uq_presupuestos_obra" UNIQUE ("id_obra"),
    CONSTRAINT "fk_presupuestos_obra"       FOREIGN KEY ("id_obra")    REFERENCES "Obras"("id_obra")       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "fk_presupuestos_creado_por" FOREIGN KEY ("creado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_presupuestos_montos" CHECK (
        "costo_mano_obra" >= 0 AND "costo_materiales_base" >= 0
        AND "costo_mermas" >= 0 AND "margen_ganancia_porcentaje" >= 0
        AND "monto_total" >= 0
    )
);

-- ----------------------------- 6. DETALLE_PRESUPUESTO ----------------
CREATE TABLE "Detalle_Presupuesto" (
    "id_detalle"              SERIAL PRIMARY KEY,
    "id_presupuesto"          INTEGER NOT NULL,
    "id_material"             INTEGER NOT NULL,
    "cantidad_requerida"      DECIMAL(10,2) NOT NULL,
    "precio_unitario_momento" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "fk_detalle_presupuesto" FOREIGN KEY ("id_presupuesto") REFERENCES "Presupuestos"("id_presupuesto") ON DELETE CASCADE   ON UPDATE CASCADE,
    CONSTRAINT "fk_detalle_material"    FOREIGN KEY ("id_material")    REFERENCES "Materiales"("id_material")     ON DELETE RESTRICT  ON UPDATE CASCADE,
    CONSTRAINT "uq_detalle_presupuesto_material" UNIQUE ("id_presupuesto", "id_material"),
    CONSTRAINT "chk_detalle_cantidad" CHECK ("cantidad_requerida" > 0),
    CONSTRAINT "chk_detalle_precio"   CHECK ("precio_unitario_momento" >= 0)
);
CREATE INDEX "idx_detalle_material" ON "Detalle_Presupuesto"("id_material");

-- ----------------------------- 7. PAGOS_OBRAS ------------------------
CREATE TABLE "Pagos_Obras" (
    "id_pago"        SERIAL PRIMARY KEY,
    "id_obra"        INTEGER NOT NULL,
    "monto_abonado"  DECIMAL(12,2) NOT NULL,
    "fecha_pago"     DATE NOT NULL,
    "tipo_pago"      "tipo_pago" NOT NULL,
    "observaciones"  VARCHAR(255),
    "registrado_por" INTEGER,
    "creado_en"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_pagos_obra"           FOREIGN KEY ("id_obra")        REFERENCES "Obras"("id_obra")       ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_pagos_registrado_por" FOREIGN KEY ("registrado_por") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chk_pagos_monto" CHECK ("monto_abonado" > 0)
);
CREATE INDEX "idx_pagos_obra"  ON "Pagos_Obras"("id_obra");
CREATE INDEX "idx_pagos_fecha" ON "Pagos_Obras"("fecha_pago");

-- ----------------------------- 8. MOVIMIENTOS_INVENTARIO -------------
CREATE TABLE "Movimientos_Inventario" (
    "id_movimiento"        SERIAL PRIMARY KEY,
    "id_material"          INTEGER NOT NULL,
    "id_obra"              INTEGER,
    "tipo_movimiento"      "tipo_movimiento" NOT NULL,
    "cantidad"             DECIMAL(10,2) NOT NULL,
    "saldo_resultante"     DECIMAL(10,2) NOT NULL,
    "costo_unitario"       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "motivo"               VARCHAR(255),
    "referencia_documento" VARCHAR(50),
    "id_usuario"           INTEGER NOT NULL,
    "fecha_movimiento"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_movimientos_material" FOREIGN KEY ("id_material") REFERENCES "Materiales"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_movimientos_obra"     FOREIGN KEY ("id_obra")     REFERENCES "Obras"("id_obra")         ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_movimientos_usuario"  FOREIGN KEY ("id_usuario")  REFERENCES "Usuarios"("id_usuario")   ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_movimientos_cantidad" CHECK ("cantidad" > 0)
);
CREATE INDEX "idx_movimientos_material_fecha" ON "Movimientos_Inventario"("id_material", "fecha_movimiento");
CREATE INDEX "idx_movimientos_obra" ON "Movimientos_Inventario"("id_obra");

-- ----------------------------- 9. AUDITORIA --------------------------
CREATE TABLE "Auditoria" (
    "id_auditoria"      BIGSERIAL PRIMARY KEY,
    "tabla_afectada"    VARCHAR(64) NOT NULL,
    "id_registro"       INTEGER NOT NULL,
    "accion"            "accion_auditoria" NOT NULL,
    "datos_anteriores"  JSONB,
    "datos_nuevos"      JSONB,
    "id_usuario"        INTEGER,
    "fecha_hora"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "fk_auditoria_usuario" FOREIGN KEY ("id_usuario") REFERENCES "Usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_auditoria_tabla_registro" ON "Auditoria"("tabla_afectada", "id_registro");
CREATE INDEX "idx_auditoria_fecha" ON "Auditoria"("fecha_hora");

-- =====================================================================
-- TRIGGERS (plpgsql)
-- =====================================================================

-- --- 9.1 Kardex: cada movimiento ajusta el stock real del material ---
CREATE OR REPLACE FUNCTION fn_movimientos_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    stock_disponible DECIMAL(10,2);
BEGIN
    SELECT "stock_actual" INTO stock_disponible
    FROM "Materiales" WHERE "id_material" = NEW."id_material" FOR UPDATE;

    IF stock_disponible IS NULL THEN
        RAISE EXCEPTION 'El material % no existe.', NEW."id_material";
    END IF;

    IF NEW."tipo_movimiento" = 'Salida' AND stock_disponible < NEW."cantidad" THEN
        RAISE EXCEPTION 'Stock insuficiente para realizar la salida de material.';
    END IF;

    IF NEW."tipo_movimiento" = 'Entrada' THEN
        NEW."saldo_resultante" := stock_disponible + NEW."cantidad";
    ELSIF NEW."tipo_movimiento" = 'Salida' THEN
        NEW."saldo_resultante" := stock_disponible - NEW."cantidad";
    ELSE
        -- Ajuste: la cantidad representa el nuevo saldo absoluto
        NEW."saldo_resultante" := NEW."cantidad";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimientos_before_insert
    BEFORE INSERT ON "Movimientos_Inventario"
    FOR EACH ROW EXECUTE FUNCTION fn_movimientos_before_insert();

CREATE OR REPLACE FUNCTION fn_movimientos_after_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "Materiales"
       SET "stock_actual" = NEW."saldo_resultante",
           "actualizado_en" = now()
     WHERE "id_material" = NEW."id_material";
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimientos_after_insert
    AFTER INSERT ON "Movimientos_Inventario"
    FOR EACH ROW EXECUTE FUNCTION fn_movimientos_after_insert();

-- --- 9.2 Presupuestos: recalcular mermas (6%) automáticamente ---
CREATE OR REPLACE FUNCTION fn_presupuestos_mermas()
RETURNS TRIGGER AS $$
BEGIN
    NEW."costo_mermas" := ROUND(NEW."costo_materiales_base" * 0.06, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_presupuestos_mermas
    BEFORE INSERT OR UPDATE OF "costo_materiales_base" ON "Presupuestos"
    FOR EACH ROW EXECUTE FUNCTION fn_presupuestos_mermas();

-- --- 9.3 Auditoría genérica: Obras y Materiales ---
CREATE OR REPLACE FUNCTION fn_obras_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "Auditoria" ("tabla_afectada", "id_registro", "accion", "datos_nuevos", "id_usuario")
        VALUES ('Obras', NEW."id_obra", 'INSERT',
            jsonb_build_object(
                'nombre_obra', NEW."nombre_obra", 'id_cliente', NEW."id_cliente",
                'estado_obra', NEW."estado_obra", 'porcentaje_avance', NEW."porcentaje_avance"),
            NEW."creado_por");
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO "Auditoria" ("tabla_afectada", "id_registro", "accion", "datos_anteriores", "datos_nuevos", "id_usuario")
        VALUES ('Obras', NEW."id_obra", 'UPDATE',
            jsonb_build_object('estado_obra', OLD."estado_obra", 'porcentaje_avance', OLD."porcentaje_avance"),
            jsonb_build_object('estado_obra', NEW."estado_obra", 'porcentaje_avance', NEW."porcentaje_avance"),
            NEW."actualizado_por");
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obras_audit
    AFTER INSERT OR UPDATE ON "Obras"
    FOR EACH ROW EXECUTE FUNCTION fn_obras_audit();

CREATE OR REPLACE FUNCTION fn_materiales_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."stock_actual" <> NEW."stock_actual" THEN
        INSERT INTO "Auditoria" ("tabla_afectada", "id_registro", "accion", "datos_anteriores", "datos_nuevos")
        VALUES ('Materiales', NEW."id_material", 'UPDATE',
            jsonb_build_object('stock_actual', OLD."stock_actual"),
            jsonb_build_object('stock_actual', NEW."stock_actual"));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_materiales_audit
    AFTER UPDATE ON "Materiales"
    FOR EACH ROW EXECUTE FUNCTION fn_materiales_audit();

-- =====================================================================
-- VISTAS DE APOYO
-- =====================================================================
CREATE OR REPLACE VIEW "v_saldo_obras" AS
SELECT
    o."id_obra",
    o."nombre_obra",
    c."nombre_razon_social",
    p."monto_total",
    COALESCE(SUM(pg."monto_abonado"), 0)                        AS "total_abonado",
    COALESCE(p."monto_total", 0) - COALESCE(SUM(pg."monto_abonado"), 0) AS "saldo_pendiente"
FROM "Obras" o
JOIN "Clientes" c            ON c."id_cliente" = o."id_cliente"
LEFT JOIN "Presupuestos" p   ON p."id_obra" = o."id_obra"
LEFT JOIN "Pagos_Obras" pg   ON pg."id_obra" = o."id_obra"
GROUP BY o."id_obra", o."nombre_obra", c."nombre_razon_social", p."monto_total";

CREATE OR REPLACE VIEW "v_materiales_bajo_stock" AS
SELECT "id_material", "codigo_material", "nombre", "stock_actual", "stock_minimo"
FROM "Materiales"
WHERE "stock_actual" <= "stock_minimo" AND "estado" = 'Activo';

-- =====================================================================
-- RLS (Row Level Security)
-- Se habilita en todas las tablas: bloquea el REST API auto-generado de
-- Supabase (roles anon/authenticated). El acceso de la app es vía Prisma
-- con el rol `postgres` (BYPASSRLS), por lo que NO se ven afectadas las
-- operaciones del backend. Añadir políticas explícitas si en el futuro
-- se expone la data a los roles de Supabase.
-- =====================================================================
ALTER TABLE "Usuarios"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Clientes"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Materiales"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Obras"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Presupuestos"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Detalle_Presupuesto"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pagos_Obras"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movimientos_Inventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Auditoria"              ENABLE ROW LEVEL SECURITY;
