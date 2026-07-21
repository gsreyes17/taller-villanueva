-- DropIndex
DROP INDEX "idx_movimientos_compra";

-- AlterTable
ALTER TABLE "Categorias" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Clientes" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Compras" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Materiales" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Obras" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Presupuestos" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Proveedores" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Usuarios" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "Auditoria" RENAME CONSTRAINT "fk_auditoria_usuario" TO "Auditoria_id_usuario_fkey";

-- RenameForeignKey
ALTER TABLE "Categorias" RENAME CONSTRAINT "fk_categorias_padre" TO "Categorias_id_categoria_padre_fkey";

-- RenameForeignKey
ALTER TABLE "Clientes" RENAME CONSTRAINT "fk_clientes_actualizado_por" TO "Clientes_actualizado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Clientes" RENAME CONSTRAINT "fk_clientes_creado_por" TO "Clientes_creado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Compras" RENAME CONSTRAINT "fk_compras_creado_por" TO "Compras_creado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Compras" RENAME CONSTRAINT "fk_compras_proveedor" TO "Compras_id_proveedor_fkey";

-- RenameForeignKey
ALTER TABLE "Costos_Indirectos_Obra" RENAME CONSTRAINT "fk_costos_ind_obra" TO "Costos_Indirectos_Obra_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Costos_Indirectos_Obra" RENAME CONSTRAINT "fk_costos_ind_usuario" TO "Costos_Indirectos_Obra_registrado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Detalle_Compra" RENAME CONSTRAINT "fk_detalle_compra_compra" TO "Detalle_Compra_id_compra_fkey";

-- RenameForeignKey
ALTER TABLE "Detalle_Compra" RENAME CONSTRAINT "fk_detalle_compra_material" TO "Detalle_Compra_id_material_fkey";

-- RenameForeignKey
ALTER TABLE "Detalle_Presupuesto" RENAME CONSTRAINT "fk_detalle_material" TO "Detalle_Presupuesto_id_material_fkey";

-- RenameForeignKey
ALTER TABLE "Detalle_Presupuesto" RENAME CONSTRAINT "fk_detalle_presupuesto" TO "Detalle_Presupuesto_id_presupuesto_fkey";

-- RenameForeignKey
ALTER TABLE "Mano_Obra_Obra" RENAME CONSTRAINT "fk_mano_obra_obra" TO "Mano_Obra_Obra_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Mano_Obra_Obra" RENAME CONSTRAINT "fk_mano_obra_usuario" TO "Mano_Obra_Obra_id_usuario_fkey";

-- RenameForeignKey
ALTER TABLE "Materiales" RENAME CONSTRAINT "fk_materiales_categoria" TO "Materiales_id_categoria_fkey";

-- RenameForeignKey
ALTER TABLE "Materiales" RENAME CONSTRAINT "fk_materiales_ubicacion" TO "Materiales_id_ubicacion_fkey";

-- RenameForeignKey
ALTER TABLE "Materiales" RENAME CONSTRAINT "fk_materiales_unidad" TO "Materiales_id_unidad_fkey";

-- RenameForeignKey
ALTER TABLE "Movimientos_Inventario" RENAME CONSTRAINT "fk_movimientos_compra" TO "Movimientos_Inventario_id_compra_fkey";

-- RenameForeignKey
ALTER TABLE "Movimientos_Inventario" RENAME CONSTRAINT "fk_movimientos_material" TO "Movimientos_Inventario_id_material_fkey";

-- RenameForeignKey
ALTER TABLE "Movimientos_Inventario" RENAME CONSTRAINT "fk_movimientos_obra" TO "Movimientos_Inventario_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Movimientos_Inventario" RENAME CONSTRAINT "fk_movimientos_usuario" TO "Movimientos_Inventario_id_usuario_fkey";

-- RenameForeignKey
ALTER TABLE "Obra_Archivos" RENAME CONSTRAINT "fk_obra_archivos_obra" TO "Obra_Archivos_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Obra_Archivos" RENAME CONSTRAINT "fk_obra_archivos_usuario" TO "Obra_Archivos_subido_por_fkey";

-- RenameForeignKey
ALTER TABLE "Obras" RENAME CONSTRAINT "fk_obras_actualizado_por" TO "Obras_actualizado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Obras" RENAME CONSTRAINT "fk_obras_cliente" TO "Obras_id_cliente_fkey";

-- RenameForeignKey
ALTER TABLE "Obras" RENAME CONSTRAINT "fk_obras_creado_por" TO "Obras_creado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Pagos_Obras" RENAME CONSTRAINT "fk_pagos_obra" TO "Pagos_Obras_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Pagos_Obras" RENAME CONSTRAINT "fk_pagos_registrado_por" TO "Pagos_Obras_registrado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Presupuestos" RENAME CONSTRAINT "fk_presupuestos_creado_por" TO "Presupuestos_creado_por_fkey";

-- RenameForeignKey
ALTER TABLE "Presupuestos" RENAME CONSTRAINT "fk_presupuestos_obra" TO "Presupuestos_id_obra_fkey";

-- RenameForeignKey
ALTER TABLE "Proveedores" RENAME CONSTRAINT "fk_proveedores_creado_por" TO "Proveedores_creado_por_fkey";

-- RenameIndex
ALTER INDEX "idx_auditoria_fecha" RENAME TO "Auditoria_fecha_hora_idx";

-- RenameIndex
ALTER INDEX "idx_auditoria_tabla_registro" RENAME TO "Auditoria_tabla_afectada_id_registro_idx";

-- RenameIndex
ALTER INDEX "idx_categorias_padre" RENAME TO "Categorias_id_categoria_padre_idx";

-- RenameIndex
ALTER INDEX "idx_clientes_estado" RENAME TO "Clientes_estado_idx";

-- RenameIndex
ALTER INDEX "uq_clientes_identificacion" RENAME TO "Clientes_identificacion_fiscal_key";

-- RenameIndex
ALTER INDEX "idx_compras_estado" RENAME TO "Compras_estado_idx";

-- RenameIndex
ALTER INDEX "idx_compras_fecha" RENAME TO "Compras_fecha_emision_idx";

-- RenameIndex
ALTER INDEX "idx_costos_ind_fecha" RENAME TO "Costos_Indirectos_Obra_fecha_idx";

-- RenameIndex
ALTER INDEX "idx_costos_ind_obra" RENAME TO "Costos_Indirectos_Obra_id_obra_idx";

-- RenameIndex
ALTER INDEX "idx_detalle_compra_material" RENAME TO "Detalle_Compra_id_material_idx";

-- RenameIndex
ALTER INDEX "idx_detalle_material" RENAME TO "Detalle_Presupuesto_id_material_idx";

-- RenameIndex
ALTER INDEX "idx_mano_obra_fecha" RENAME TO "Mano_Obra_Obra_fecha_idx";

-- RenameIndex
ALTER INDEX "idx_mano_obra_obra" RENAME TO "Mano_Obra_Obra_id_obra_idx";

-- RenameIndex
ALTER INDEX "idx_materiales_categoria_fk" RENAME TO "Materiales_id_categoria_idx";

-- RenameIndex
ALTER INDEX "idx_materiales_estado" RENAME TO "Materiales_estado_idx";

-- RenameIndex
ALTER INDEX "idx_materiales_ubicacion" RENAME TO "Materiales_id_ubicacion_idx";

-- RenameIndex
ALTER INDEX "uq_materiales_codigo" RENAME TO "Materiales_codigo_material_key";

-- RenameIndex
ALTER INDEX "idx_movimientos_material_fecha" RENAME TO "Movimientos_Inventario_id_material_fecha_movimiento_idx";

-- RenameIndex
ALTER INDEX "idx_movimientos_obra" RENAME TO "Movimientos_Inventario_id_obra_idx";

-- RenameIndex
ALTER INDEX "idx_obra_archivos_obra" RENAME TO "Obra_Archivos_id_obra_idx";

-- RenameIndex
ALTER INDEX "idx_obras_cliente" RENAME TO "Obras_id_cliente_idx";

-- RenameIndex
ALTER INDEX "idx_obras_estado" RENAME TO "Obras_estado_obra_idx";

-- RenameIndex
ALTER INDEX "idx_pagos_fecha" RENAME TO "Pagos_Obras_fecha_pago_idx";

-- RenameIndex
ALTER INDEX "idx_pagos_obra" RENAME TO "Pagos_Obras_id_obra_idx";

-- RenameIndex
ALTER INDEX "uq_presupuestos_obra" RENAME TO "Presupuestos_id_obra_key";

-- RenameIndex
ALTER INDEX "idx_proveedores_estado" RENAME TO "Proveedores_estado_idx";

-- RenameIndex
ALTER INDEX "uq_proveedores_ruc" RENAME TO "Proveedores_ruc_key";

-- RenameIndex
ALTER INDEX "idx_ubicaciones_zona" RENAME TO "Ubicaciones_zona_idx";

-- RenameIndex
ALTER INDEX "uq_unidades_simbolo" RENAME TO "Unidades_Medida_simbolo_key";

-- RenameIndex
ALTER INDEX "uq_usuarios_correo" RENAME TO "Usuarios_correo_key";

-- RenameIndex
ALTER INDEX "uq_usuarios_nombre_usuario" RENAME TO "Usuarios_nombre_usuario_key";
