// Documentos de otros módulos que pertenecen a un proyecto. Solo lectura;
// las fechas salen como texto 'YYYY-MM-DD' para no depender de zonas horarias.

async function obtenerCotizacion(pool, cotizacionId) {
  const [filas] = await pool.query(
    `SELECT co.id, co.numero_cotizacion, co.estado, co.cliente_id,
            DATE_FORMAT(co.created_at, '%Y-%m-%d') AS creada,
            DATE_FORMAT(co.fecha_validez, '%Y-%m-%d') AS fecha_validez,
            COALESCE(SUM(ci.cantidad * ci.valor_unitario
              * (1 - ci.descuento_porcentaje / 100) * (1 + ci.iva_porcentaje / 100)), 0) AS valor
     FROM cotizaciones co
     LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = co.id
     WHERE co.id = ? AND co.deleted_at IS NULL
     GROUP BY co.id, co.numero_cotizacion, co.estado, co.cliente_id, co.created_at, co.fecha_validez`,
    [cotizacionId]
  );
  return filas[0] ? { ...filas[0], valor: Number(filas[0].valor) } : null;
}

async function listarExpedientes(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT e.id, e.codigo_expediente, e.producto_nombre, e.modelo, e.numero_serie,
            e.estado_liberacion, u.nombre AS responsable,
            DATE_FORMAT(e.created_at, '%Y-%m-%d') AS creado
     FROM expedientes_diseno e
     LEFT JOIN usuarios u ON u.id = e.responsable_diseno_id
     WHERE e.proyecto_id = ? AND e.deleted_at IS NULL
     ORDER BY e.created_at, e.id`,
    [proyectoId]
  );
  return filas;
}

async function listarRequisiciones(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT r.id, r.numero_requisicion, r.estado, r.procedencia, u.nombre AS solicitante,
            DATE_FORMAT(r.created_at, '%Y-%m-%d') AS creada,
            (SELECT COUNT(*) FROM requisicion_items ri WHERE ri.requisicion_id = r.id) AS items
     FROM requisiciones r
     LEFT JOIN usuarios u ON u.id = r.solicitante_id
     WHERE r.proyecto_id = ? AND r.deleted_at IS NULL
     ORDER BY r.created_at, r.id`,
    [proyectoId]
  );
  return filas.map((f) => ({ ...f, items: Number(f.items) }));
}

async function listarOrdenesCompra(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT oc.id, oc.numero_oc, oc.estado, pr.razon_social AS proveedor,
            r.id AS requisicion_id, r.numero_requisicion,
            DATE_FORMAT(oc.created_at, '%Y-%m-%d') AS creada,
            COALESCE(SUM(oci.cantidad * oci.precio_unitario), 0) AS valor
     FROM ordenes_compra oc
     JOIN requisiciones r ON r.id = oc.requisicion_id AND r.deleted_at IS NULL
     JOIN proveedores pr ON pr.id = oc.proveedor_id
     LEFT JOIN orden_compra_items oci ON oci.orden_compra_id = oc.id
     WHERE r.proyecto_id = ? AND oc.deleted_at IS NULL
     GROUP BY oc.id, oc.numero_oc, oc.estado, pr.razon_social, r.id, r.numero_requisicion, oc.created_at
     ORDER BY oc.created_at, oc.id`,
    [proyectoId]
  );
  return filas.map((f) => ({ ...f, valor: Number(f.valor) }));
}

// Reportes del proyecto y también los de sus equipos registrados en otro
// proyecto (p. ej. un contrato de mantenimiento posterior del mismo cliente).
async function listarReportesServicio(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT r.id, r.numero_reporte, r.tipo_servicio, r.equipo_numero_serie, r.en_garantia,
            r.proyecto_id, pr.codigo_pry AS proyecto_codigo, r.cliente_id,
            q.proyecto_id AS proyecto_equipo_id, q.cliente_id AS cliente_equipo_id,
            u.nombre AS tecnico,
            DATE_FORMAT(r.fecha_servicio, '%Y-%m-%d') AS fecha_servicio,
            DATE_FORMAT(r.created_at, '%Y-%m-%d') AS creado
     FROM reportes_servicio_tecnico r
     JOIN proyectos pr ON pr.id = r.proyecto_id
     LEFT JOIN equipos q ON q.numero_serie = r.equipo_numero_serie
     LEFT JOIN usuarios u ON u.id = r.tecnico_responsable_id
     WHERE r.deleted_at IS NULL AND (r.proyecto_id = ? OR q.proyecto_id = ?)
     ORDER BY COALESCE(r.fecha_servicio, DATE(r.created_at)), r.id`,
    [proyectoId, proyectoId]
  );
  return filas.map((f) => ({ ...f, en_garantia: Boolean(f.en_garantia) }));
}

async function listarEquipos(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT id, numero_serie, descripcion, origen
     FROM equipos WHERE proyecto_id = ? AND deleted_at IS NULL
     ORDER BY numero_serie`,
    [proyectoId]
  );
  return filas;
}

async function listarActasEntrega(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT a.id, a.numero_acta, a.cliente_id, a.receptor_nombre,
            DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d') AS fecha_elaboracion,
            (SELECT COUNT(*) FROM acta_entrega_items i WHERE i.acta_id = a.id) AS equipos,
            (SELECT COUNT(*) FROM acta_entrega_items i
              JOIN expedientes_diseno e ON e.id = i.expediente_id
              WHERE i.acta_id = a.id AND e.proyecto_id <> a.proyecto_id) AS equipos_de_otro_proyecto
     FROM actas_entrega_equipos a
     WHERE a.proyecto_id = ? AND a.deleted_at IS NULL
     ORDER BY a.fecha_elaboracion, a.id`,
    [proyectoId]
  );
  return filas.map((f) => ({
    ...f,
    equipos: Number(f.equipos),
    equipos_de_otro_proyecto: Number(f.equipos_de_otro_proyecto),
  }));
}

async function listarActasCierre(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT a.id, a.numero_acta, a.cliente_id, a.tipo_entrega, a.acta_entrega_id,
            ae.numero_acta AS acta_entrega_numero, ae.proyecto_id AS acta_entrega_proyecto_id,
            DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d') AS fecha_elaboracion
     FROM actas_cierre_satisfaccion a
     LEFT JOIN actas_entrega_equipos ae ON ae.id = a.acta_entrega_id AND ae.deleted_at IS NULL
     WHERE a.proyecto_id = ? AND a.deleted_at IS NULL
     ORDER BY a.fecha_elaboracion, a.id`,
    [proyectoId]
  );
  return filas;
}

// Cuántos documentos de otros módulos dependen del proyecto (lo que impide
// eliminarlo). Actividades, equipo de trabajo y evidencias son del propio
// proyecto y no cuentan.
async function contarDocumentosEnlazados(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM expedientes_diseno WHERE proyecto_id = ? AND deleted_at IS NULL) AS expedientes,
       (SELECT COUNT(*) FROM requisiciones WHERE proyecto_id = ? AND deleted_at IS NULL) AS requisiciones,
       (SELECT COUNT(*) FROM ordenes_compra oc JOIN requisiciones r ON r.id = oc.requisicion_id
          WHERE r.proyecto_id = ? AND oc.deleted_at IS NULL) AS ordenes_compra,
       (SELECT COUNT(*) FROM reportes_servicio_tecnico WHERE proyecto_id = ? AND deleted_at IS NULL) AS reportes_servicio,
       (SELECT COUNT(*) FROM actas_entrega_equipos WHERE proyecto_id = ? AND deleted_at IS NULL) AS actas_entrega,
       (SELECT COUNT(*) FROM actas_cierre_satisfaccion WHERE proyecto_id = ? AND deleted_at IS NULL) AS actas_cierre,
       (SELECT COUNT(*) FROM equipos WHERE proyecto_id = ? AND deleted_at IS NULL) AS equipos`,
    Array(7).fill(proyectoId)
  );
  return Object.fromEntries(Object.entries(filas[0]).map(([k, v]) => [k, Number(v)]));
}

module.exports = {
  contarDocumentosEnlazados,
  obtenerCotizacion,
  listarExpedientes,
  listarRequisiciones,
  listarOrdenesCompra,
  listarReportesServicio,
  listarEquipos,
  listarActasEntrega,
  listarActasCierre,
};
