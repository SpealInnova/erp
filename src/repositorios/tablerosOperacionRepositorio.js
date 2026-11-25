// Consultas de solo lectura para los resúmenes de Diseño, Soporte y Entregas.
// Como en tablerosRepositorio, las fechas salen de SQL ya como texto
// 'YYYY-MM-DD' para no depender de zonas horarias.

/* ---------------- Diseño ---------------- */

async function listarExpedientes(pool) {
  const [filas] = await pool.query(
    `SELECT e.id, e.codigo_expediente, e.producto_nombre, e.modelo, e.numero_serie,
            e.estado_liberacion, e.proyecto_id, p.codigo_pry, u.nombre AS responsable,
            DATE_FORMAT(e.created_at, '%Y-%m-%d') AS creada,
            DATE_FORMAT(e.updated_at, '%Y-%m-%d') AS actualizada
     FROM expedientes_diseno e
     JOIN proyectos p ON p.id = e.proyecto_id
     LEFT JOIN usuarios u ON u.id = e.responsable_diseno_id
     WHERE e.deleted_at IS NULL
     ORDER BY e.created_at, e.id`
  );
  return filas;
}

// Lo registrado en cada paso del expediente, para saber qué falta para
// liberarlo (la misma revisión que hace el expediente guiado).
async function listarPasosDeExpedientes(pool, ids) {
  if (!ids.length) {
    return {
      requisitos: [],
      salidas: [],
      revisiones: [],
      riesgos: [],
      verificaciones: [],
      validaciones: [],
      transferencias: [],
    };
  }
  const consulta = async (sql) => (await pool.query(sql, [ids]))[0];
  const [requisitos, salidas, revisiones, riesgos, verificaciones, validaciones, transferencias] =
    await Promise.all([
      consulta(
        `SELECT expediente_id, requisito FROM requisitos_entrada
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id, estado FROM salidas_diseno
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id, cierre FROM revisiones_diseno
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id, severidad, probabilidad FROM riesgos_diseno
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id, requisito_verificado, resultado FROM verificaciones
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id, resultado FROM validaciones
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
      consulta(
        `SELECT expediente_id FROM transferencias
         WHERE deleted_at IS NULL AND expediente_id IN (?)`
      ),
    ]);
  return { requisitos, salidas, revisiones, riesgos, verificaciones, validaciones, transferencias };
}

/* ---------------- Soporte técnico ---------------- */

// Reportes desde una fecha. La fecha del servicio es la registrada o, si no
// la hay, la de creación del reporte. Los minutos solo cuando hay hora de
// inicio y de fin coherentes.
async function listarReportesDesde(pool, desdeTexto) {
  const [filas] = await pool.query(
    `SELECT r.id, r.numero_reporte, r.equipo_numero_serie, r.tipo_servicio, r.en_garantia,
            r.tecnico_responsable_id AS tecnico_id, u.nombre AS tecnico,
            c.nombre_razon_social AS cliente, p.codigo_pry,
            DATE_FORMAT(COALESCE(r.fecha_servicio, DATE(r.created_at)), '%Y-%m-%d') AS fecha,
            CASE WHEN r.hora_inicio IS NOT NULL AND r.hora_fin IS NOT NULL AND r.hora_fin > r.hora_inicio
                 THEN TIME_TO_SEC(TIMEDIFF(r.hora_fin, r.hora_inicio)) / 60 END AS minutos
     FROM reportes_servicio_tecnico r
     JOIN clientes c ON c.id = r.cliente_id
     LEFT JOIN proyectos p ON p.id = r.proyecto_id
     LEFT JOIN usuarios u ON u.id = r.tecnico_responsable_id
     WHERE r.deleted_at IS NULL AND COALESCE(r.fecha_servicio, DATE(r.created_at)) >= ?
     ORDER BY fecha DESC, r.id DESC`,
    [desdeTexto]
  );
  return filas.map((f) => ({
    ...f,
    en_garantia: Boolean(f.en_garantia),
    minutos: f.minutos === null ? null : Number(f.minutos),
  }));
}

async function listarEquiposConServicio(pool) {
  const [filas] = await pool.query(
    `SELECT q.id, q.numero_serie, q.descripcion, q.origen, c.nombre_razon_social AS cliente,
            DATE_FORMAT(q.fecha_instalacion, '%Y-%m-%d') AS fecha_instalacion,
            DATE_FORMAT(q.created_at, '%Y-%m-%d') AS creado,
            (SELECT DATE_FORMAT(MAX(COALESCE(r.fecha_servicio, DATE(r.created_at))), '%Y-%m-%d')
               FROM reportes_servicio_tecnico r
              WHERE r.equipo_numero_serie = q.numero_serie AND r.deleted_at IS NULL) AS ultimo_servicio
     FROM equipos q
     JOIN clientes c ON c.id = q.cliente_id
     WHERE q.deleted_at IS NULL`
  );
  return filas;
}

/* ---------------- Entregas y cierre ---------------- */

async function listarActasEntrega(pool) {
  const [filas] = await pool.query(
    `SELECT a.id, a.numero_acta, a.proyecto_id, p.codigo_pry, p.nombre_proyecto,
            c.nombre_razon_social AS cliente,
            DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d') AS fecha,
            (SELECT COUNT(*) FROM acta_entrega_items i WHERE i.acta_id = a.id) AS items,
            (SELECT COUNT(*) FROM acta_entrega_items i
              WHERE i.acta_id = a.id AND i.cumple = 'no') AS items_no_cumplen
     FROM actas_entrega_equipos a
     JOIN proyectos p ON p.id = a.proyecto_id
     JOIN clientes c ON c.id = a.cliente_id
     WHERE a.deleted_at IS NULL
     ORDER BY a.fecha_elaboracion, a.id`
  );
  return filas.map((f) => ({
    ...f,
    items: Number(f.items),
    items_no_cumplen: Number(f.items_no_cumplen),
  }));
}

async function listarActasCierre(pool) {
  const [filas] = await pool.query(
    `SELECT a.id, a.numero_acta, a.proyecto_id, a.acta_entrega_id, a.tipo_entrega,
            p.codigo_pry, DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d') AS fecha,
            (SELECT COUNT(*) FROM acta_items_verificados i WHERE i.acta_id = a.id) AS items,
            (SELECT COUNT(*) FROM acta_items_verificados i
              WHERE i.acta_id = a.id AND i.cumple = 'no') AS items_no_cumplen
     FROM actas_cierre_satisfaccion a
     JOIN proyectos p ON p.id = a.proyecto_id
     WHERE a.deleted_at IS NULL
     ORDER BY a.fecha_elaboracion, a.id`
  );
  return filas.map((f) => ({
    ...f,
    items: Number(f.items),
    items_no_cumplen: Number(f.items_no_cumplen),
  }));
}

// Proyectos en las fases de entrega, con cuántas actas de entrega tienen.
async function listarProyectosEnFases(pool, estados) {
  const [filas] = await pool.query(
    `SELECT p.id, p.codigo_pry, p.nombre_proyecto, p.estado, c.nombre_razon_social AS cliente,
            (SELECT COUNT(*) FROM actas_entrega_equipos a
              WHERE a.proyecto_id = p.id AND a.deleted_at IS NULL) AS actas_entrega
     FROM proyectos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE p.deleted_at IS NULL AND p.estado IN (?)
     ORDER BY p.codigo_pry`,
    [estados]
  );
  return filas.map((f) => ({ ...f, actas_entrega: Number(f.actas_entrega) }));
}

// Ítems entregados o verificados que no cumplen, de las dos clases de acta.
async function listarItemsNoCumplen(pool, desdeTexto) {
  const [filas] = await pool.query(
    `SELECT 'entrega' AS acta_tipo, a.id AS acta_id, a.numero_acta, p.codigo_pry,
            DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d') AS fecha,
            i.descripcion_equipo AS elemento, i.numero_serie
     FROM acta_entrega_items i
     JOIN actas_entrega_equipos a ON a.id = i.acta_id AND a.deleted_at IS NULL
     JOIN proyectos p ON p.id = a.proyecto_id
     WHERE i.cumple = 'no' AND a.fecha_elaboracion >= ?
     UNION ALL
     SELECT 'cierre', a.id, a.numero_acta, p.codigo_pry,
            DATE_FORMAT(a.fecha_elaboracion, '%Y-%m-%d'), i.elemento, NULL
     FROM acta_items_verificados i
     JOIN actas_cierre_satisfaccion a ON a.id = i.acta_id AND a.deleted_at IS NULL
     JOIN proyectos p ON p.id = a.proyecto_id
     WHERE i.cumple = 'no' AND a.fecha_elaboracion >= ?
     ORDER BY fecha DESC`,
    [desdeTexto, desdeTexto]
  );
  return filas;
}

module.exports = {
  listarExpedientes,
  listarPasosDeExpedientes,
  listarReportesDesde,
  listarEquiposConServicio,
  listarActasEntrega,
  listarActasCierre,
  listarProyectosEnFases,
  listarItemsNoCumplen,
};
