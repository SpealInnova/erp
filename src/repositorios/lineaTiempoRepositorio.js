async function listarEventosProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT a.*
     FROM auditoria a
     WHERE (a.tabla = 'proyectos' AND a.registro_id = ?)
        OR (a.tabla = 'proyecto_actividades' AND a.registro_id IN (
              SELECT id FROM proyecto_actividades WHERE proyecto_id = ?
            ))
        OR (a.tabla = 'proyecto_equipo' AND a.registro_id IN (
              SELECT id FROM proyecto_equipo WHERE proyecto_id = ?
            ))
        -- documentos de otros módulos enlazados al proyecto
        OR (a.tabla = 'expedientes_diseno' AND a.registro_id IN (
              SELECT id FROM expedientes_diseno WHERE proyecto_id = ?
            ))
        OR (a.tabla = 'requisiciones' AND a.registro_id IN (
              SELECT id FROM requisiciones WHERE proyecto_id = ?
            ))
        OR (a.tabla = 'ordenes_compra' AND a.registro_id IN (
              SELECT oc.id FROM ordenes_compra oc
              JOIN requisiciones r ON r.id = oc.requisicion_id
              WHERE r.proyecto_id = ?
            ))
        OR (a.tabla = 'reportes_servicio_tecnico' AND a.registro_id IN (
              SELECT id FROM reportes_servicio_tecnico WHERE proyecto_id = ?
            ))
        OR (a.tabla = 'actas_entrega_equipos' AND a.registro_id IN (
              SELECT id FROM actas_entrega_equipos WHERE proyecto_id = ?
            ))
        OR (a.tabla = 'actas_cierre_satisfaccion' AND a.registro_id IN (
              SELECT id FROM actas_cierre_satisfaccion WHERE proyecto_id = ?
            ))
     ORDER BY a.creado_en DESC, a.id DESC`,
    Array(9).fill(proyectoId)
  );
  return filas;
}

async function listarUsuariosPorIds(pool, ids) {
  if (ids.length === 0) {
    return [];
  }
  const [filas] = await pool.query("SELECT id, nombre FROM usuarios WHERE id IN (?)", [ids]);
  return filas;
}

module.exports = { listarEventosProyecto, listarUsuariosPorIds };
