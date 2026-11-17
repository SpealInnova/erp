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
            cl.nombre_razon_social AS cliente, u.nombre AS asesor,
            DATE_FORMAT(co.created_at, '%Y-%m-%d') AS creada,
            DATE_FORMAT(co.updated_at, '%Y-%m-%d') AS actualizada,
            DATE_FORMAT(co.fecha_validez, '%Y-%m-%d') AS fecha_validez,
            COUNT(ci.id) AS items,
            COALESCE(SUM(${VALOR_ITEM_COTIZACION}), 0) AS valor,
            (SELECT descripcion FROM cotizacion_items
              WHERE cotizacion_id = co.id ORDER BY id LIMIT 1) AS primer_item
     FROM cotizaciones co
     JOIN clientes cl ON cl.id = co.cliente_id
     LEFT JOIN usuarios u ON u.id = co.asesor_comercial_id
     LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = co.id
     WHERE co.deleted_at IS NULL
     GROUP BY co.id, co.numero_cotizacion, co.estado, co.cliente_id, cl.nombre_razon_social,
              u.nombre, co.created_at, co.updated_at, co.fecha_validez
     ORDER BY co.created_at DESC`
  );
  return filas.map((f) => ({ ...f, items: Number(f.items), valor: Number(f.valor) }));
}

// Clientes con su actividad: proyectos en curso y la última fecha en que se
// movió algo suyo (proyecto o cotización).
async function listarClientesConActividad(pool, estadosTerminados) {
  const [filas] = await pool.query(
    `SELECT cl.id, cl.nombre_razon_social AS nombre, cl.tipo_identificacion,
            cl.numero_identificacion, cl.ciudad,
            DATE_FORMAT(cl.created_at, '%Y-%m-%d') AS creado,
            (SELECT COUNT(*) FROM proyectos p
              WHERE p.cliente_id = cl.id AND p.deleted_at IS NULL
                AND p.estado NOT IN (?)) AS proyectos_activos,
            DATE_FORMAT(GREATEST(
              cl.updated_at,
              COALESCE((SELECT MAX(p.updated_at) FROM proyectos p
                         WHERE p.cliente_id = cl.id AND p.deleted_at IS NULL), cl.updated_at),
              COALESCE((SELECT MAX(co.updated_at) FROM cotizaciones co
                         WHERE co.cliente_id = cl.id AND co.deleted_at IS NULL), cl.updated_at)
            ), '%Y-%m-%d') AS ultima_actividad
     FROM clientes cl
     WHERE cl.deleted_at IS NULL
     ORDER BY cl.nombre_razon_social`,
    [estadosTerminados]
  );
  return filas.map((f) => ({ ...f, proyectos_activos: Number(f.proyectos_activos) }));
}

async function listarRequisiciones(pool) {
  const [filas] = await pool.query(
    `SELECT r.id, r.numero_requisicion, r.estado, r.procedencia,
            p.id AS proyecto_id, p.codigo_pry, u.nombre AS solicitante,
            DATE_FORMAT(r.created_at, '%Y-%m-%d') AS creada,
            (SELECT COUNT(*) FROM requisicion_items ri WHERE ri.requisicion_id = r.id) AS items,
            (SELECT DATE_FORMAT(MIN(oc.created_at), '%Y-%m-%d') FROM ordenes_compra oc
              WHERE oc.requisicion_id = r.id AND oc.deleted_at IS NULL) AS primera_oc
     FROM requisiciones r
     JOIN proyectos p ON p.id = r.proyecto_id
     LEFT JOIN usuarios u ON u.id = r.solicitante_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.created_at DESC, r.id DESC`
  );
  return filas.map((f) => ({ ...f, items: Number(f.items) }));
}

async function listarOrdenesCompra(pool) {
  const [filas] = await pool.query(
    `SELECT oc.id, oc.numero_oc, oc.estado, oc.created_by, pr.razon_social AS proveedor,
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
     WHERE oc.deleted_at IS NULL AND r.deleted_at IS NULL
     GROUP BY oc.id, oc.numero_oc, oc.estado, oc.created_by, pr.razon_social, p.id, p.codigo_pry,
              r.procedencia, oc.created_at
     ORDER BY oc.created_at, oc.id`
  );
  return filas.map((f) => ({ ...f, items: Number(f.items), valor: Number(f.valor) }));
}

// Cambios de estado registrados en auditoría. El estado se extrae en SQL
// (no se compara allí) para no depender de cómo el motor tipa las columnas
// JSON ni de colaciones distintas entre MySQL y MariaDB.
async function listarCambiosDeEstado(pool, tabla, ids) {
  if (!ids.length) return [];
  const [filas] = await pool.query(
    `SELECT registro_id, DATE_FORMAT(creado_en, '%Y-%m-%d') AS fecha,
            JSON_UNQUOTE(JSON_EXTRACT(datos_anteriores, '$.estado')) AS estado_anterior,
            JSON_UNQUOTE(JSON_EXTRACT(datos_nuevos, '$.estado')) AS estado_nuevo
     FROM auditoria
     WHERE tabla = ? AND accion = 'actualizar' AND registro_id IN (?)
     ORDER BY creado_en, id`,
    [tabla, ids]
  );
  return filas;
}

async function listarProveedoresCalificados(pool) {
  const [filas] = await pool.query(
    `SELECT id, razon_social, origen, calificacion_actual
     FROM proveedores
     WHERE deleted_at IS NULL AND calificacion_actual IS NOT NULL
     ORDER BY calificacion_actual DESC, razon_social`
  );
  return filas.map((f) => ({ ...f, calificacion_actual: Number(f.calificacion_actual) }));
}

async function contarProveedores(pool) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM proveedores WHERE deleted_at IS NULL"
  );
  return Number(filas[0].total);
}

// Presupuesto frente a lo comprometido en OC y lo ya pagado, por proyecto en curso.
async function listarPresupuestoProyectos(pool, estadosTerminados, estadosPagados) {
  const [filas] = await pool.query(
    `SELECT p.id, p.codigo_pry, p.nombre_proyecto, p.presupuesto_estimado,
            COALESCE(SUM(oci.cantidad * oci.precio_unitario), 0) AS comprometido,
            COALESCE(SUM(CASE WHEN oc.estado IN (?) THEN oci.cantidad * oci.precio_unitario END), 0) AS pagado
     FROM proyectos p
     LEFT JOIN requisiciones r ON r.proyecto_id = p.id AND r.deleted_at IS NULL
     LEFT JOIN ordenes_compra oc ON oc.requisicion_id = r.id AND oc.deleted_at IS NULL
     LEFT JOIN orden_compra_items oci ON oci.orden_compra_id = oc.id
     WHERE p.deleted_at IS NULL AND p.estado NOT IN (?)
     GROUP BY p.id, p.codigo_pry, p.nombre_proyecto, p.presupuesto_estimado`,
    [estadosPagados, estadosTerminados]
  );
  return filas.map((f) => ({
    ...f,
    presupuesto_estimado: f.presupuesto_estimado === null ? null : Number(f.presupuesto_estimado),
    comprometido: Number(f.comprometido),
    pagado: Number(f.pagado),
  }));
}

async function listarOrdenesPorAprobar(pool) {
  const [filas] = await pool.query(
    `SELECT oc.id, oc.numero_oc, oc.created_by, pr.razon_social AS proveedor,
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
     GROUP BY oc.id, oc.numero_oc, oc.created_by, pr.razon_social, p.id, p.codigo_pry, r.procedencia, oc.created_at
     ORDER BY oc.created_at`
  );
  return filas.map((f) => ({ ...f, items: Number(f.items), valor: Number(f.valor) }));
}

async function listarCambiosDisenoPendientes(pool) {
  const [filas] = await pool.query(
    `SELECT cd.id, cd.expediente_id, cd.numero, cd.descripcion, cd.created_by,
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
  listarClientesConActividad,
  listarRequisiciones,
  listarOrdenesCompra,
  listarCambiosDeEstado,
  listarProveedoresCalificados,
  contarProveedores,
  listarPresupuestoProyectos,
};
