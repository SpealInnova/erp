// Consultas de solo lectura para los tableros. Las fechas salen ya formateadas
// como texto 'YYYY-MM-DD' desde SQL para que el navegador no tenga que
// adivinar zonas horarias (mysql2 serializa DATE como ISO en UTC).

const VALOR_ITEM_COTIZACION = `ci.cantidad * ci.valor_unitario
  * (1 - ci.descuento_porcentaje / 100) * (1 + ci.iva_porcentaje / 100)`;

async function contarProyectosPorEstado(pool) {
  const [filas] = await pool.query(
    `SELECT estado, COUNT(*) AS cantidad
     FROM proyectos
     WHERE deleted_at IS NULL
     GROUP BY estado`
  );
  return filas.map((f) => ({ estado: f.estado, cantidad: Number(f.cantidad) }));
}

async function listarCarteraProyectos(pool, estados) {
  const [filas] = await pool.query(
    `SELECT p.id, p.codigo_pry, p.nombre_proyecto, p.estado, p.presupuesto_estimado,
            c.nombre_razon_social AS cliente, u.nombre AS responsable,
            DATE_FORMAT(COALESCE(MIN(a.fecha_inicio), DATE(p.created_at)), '%Y-%m-%d') AS fecha_inicio,
            DATE_FORMAT(MAX(a.fecha_fin), '%Y-%m-%d') AS fecha_fin,
            COUNT(a.id) AS actividades_total,
            COALESCE(SUM(a.estado = 'completada'), 0) AS actividades_completadas
     FROM proyectos p
     JOIN clientes c ON c.id = p.cliente_id
     JOIN usuarios u ON u.id = p.responsable_id
     LEFT JOIN proyecto_actividades a ON a.proyecto_id = p.id AND a.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.estado IN (?)
     GROUP BY p.id, p.codigo_pry, p.nombre_proyecto, p.estado, p.presupuesto_estimado,
              c.nombre_razon_social, u.nombre, p.created_at
     ORDER BY fecha_inicio, p.id`,
    [estados]
  );
  return filas.map((f) => ({
    ...f,
    presupuesto_estimado: f.presupuesto_estimado === null ? null : Number(f.presupuesto_estimado),
    actividades_total: Number(f.actividades_total),
    actividades_completadas: Number(f.actividades_completadas),
  }));
}

async function sumarComprometidoPorProyecto(pool) {
  const [filas] = await pool.query(
    `SELECT r.proyecto_id, SUM(oci.cantidad * oci.precio_unitario) AS comprometido
     FROM orden_compra_items oci
     JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id
     JOIN requisiciones r ON r.id = oc.requisicion_id
     WHERE oc.deleted_at IS NULL AND r.deleted_at IS NULL
     GROUP BY r.proyecto_id`
  );
  return new Map(filas.map((f) => [f.proyecto_id, Number(f.comprometido)]));
}

async function listarCotizacionesConValor(pool) {
  const [filas] = await pool.query(
    `SELECT co.id, co.numero_cotizacion, co.estado, co.cliente_id,
            cl.nombre_razon_social AS cliente,
            DATE_FORMAT(co.created_at, '%Y-%m-%d') AS creada,
            DATE_FORMAT(co.updated_at, '%Y-%m-%d') AS actualizada,
            DATE_FORMAT(co.fecha_validez, '%Y-%m-%d') AS fecha_validez,
            COALESCE(SUM(${VALOR_ITEM_COTIZACION}), 0) AS valor
     FROM cotizaciones co
     JOIN clientes cl ON cl.id = co.cliente_id
     LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = co.id
     WHERE co.deleted_at IS NULL
     GROUP BY co.id, co.numero_cotizacion, co.estado, co.cliente_id, cl.nombre_razon_social,
              co.created_at, co.updated_at, co.fecha_validez
     ORDER BY co.created_at DESC`
  );
  return filas.map((f) => ({ ...f, valor: Number(f.valor) }));
}

async function listarOrdenesPorAprobar(pool) {
  const [filas] = await pool.query(
    `SELECT oc.id, oc.numero_oc, pr.razon_social AS proveedor,
            p.id AS proyecto_id, p.codigo_pry, r.procedencia,
            DATE_FORMAT(oc.created_at, '%Y-%m-%d') AS creada,
            COUNT(oci.id) AS items,
            COALESCE(SUM(oci.cantidad * oci.precio_unitario), 0) AS valor,
            (SELECT descripcion FROM orden_compra_items
              WHERE orden_compra_id = oc.id ORDER BY id LIMIT 1) AS primer_item
     FROM ordenes_compra oc
     JOIN proveedores pr ON pr.id = oc.proveedor_id
     JOIN requisiciones r ON r.id = oc.requisicion_id
     JOIN proyectos p ON p.id = r.proyecto_id
     LEFT JOIN orden_compra_items oci ON oci.orden_compra_id = oc.id
     WHERE oc.deleted_at IS NULL AND oc.estado = 'pte_aprobar'
     GROUP BY oc.id, oc.numero_oc, pr.razon_social, p.id, p.codigo_pry, r.procedencia, oc.created_at
     ORDER BY oc.created_at`
  );
  return filas.map((f) => ({ ...f, items: Number(f.items), valor: Number(f.valor) }));
}

async function listarCambiosDisenoPendientes(pool) {
  const [filas] = await pool.query(
    `SELECT cd.id, cd.expediente_id, cd.numero, cd.descripcion,
            DATE_FORMAT(cd.created_at, '%Y-%m-%d') AS creado,
            e.codigo_expediente, e.producto_nombre, u.nombre AS solicitante
     FROM cambios_diseno cd
     JOIN expedientes_diseno e ON e.id = cd.expediente_id AND e.deleted_at IS NULL
     LEFT JOIN usuarios u ON u.id = cd.created_by
     WHERE cd.deleted_at IS NULL AND cd.estado = 'pendiente'
     ORDER BY cd.created_at`
  );
  return filas;
}

async function contarExpedientesSinLiberar(pool) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total FROM expedientes_diseno
     WHERE deleted_at IS NULL AND estado_liberacion = 'pendiente'`
  );
  return Number(filas[0].total);
}

async function contarActividadesAbiertasPorResponsable(pool, estadosCerrados) {
  const [filas] = await pool.query(
    `SELECT a.responsable_id, u.nombre, COUNT(*) AS abiertas
     FROM proyecto_actividades a
     JOIN proyectos p ON p.id = a.proyecto_id
     LEFT JOIN usuarios u ON u.id = a.responsable_id
     WHERE a.deleted_at IS NULL AND a.estado <> 'completada'
       AND p.deleted_at IS NULL AND p.estado NOT IN (?)
     GROUP BY a.responsable_id, u.nombre
     ORDER BY abiertas DESC`,
    [estadosCerrados]
  );
  return filas.map((f) => ({
    usuario_id: f.responsable_id,
    nombre: f.nombre,
    abiertas: Number(f.abiertas),
  }));
}

module.exports = {
  contarProyectosPorEstado,
  listarCarteraProyectos,
  sumarComprometidoPorProyecto,
  listarCotizacionesConValor,
  listarOrdenesPorAprobar,
  listarCambiosDisenoPendientes,
  contarExpedientesSinLiberar,
  contarActividadesAbiertasPorResponsable,
};
