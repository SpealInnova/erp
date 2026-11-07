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
     ORDER BY a.creado_en DESC, a.id DESC`,
    [proyectoId, proyectoId, proyectoId]
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
