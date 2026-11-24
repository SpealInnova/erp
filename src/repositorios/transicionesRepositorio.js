async function registrar(
  pool,
  { entidad, registroId, proyectoId, estadoAnterior, estadoNuevo, usuarioId }
) {
  await pool.query(
    `INSERT INTO transiciones_estado
       (entidad, registro_id, proyecto_id, estado_anterior, estado_nuevo, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entidad,
      registroId,
      proyectoId || null,
      estadoAnterior || null,
      estadoNuevo,
      usuarioId || null,
    ]
  );
}

// Transiciones de varios registros de una entidad, en orden de ocurrencia.
async function listarPorRegistros(pool, entidad, registroIds) {
  if (registroIds.length === 0) return [];
  const [filas] = await pool.query(
    `SELECT registro_id, estado_anterior, estado_nuevo, usuario_id, created_at
       FROM transiciones_estado
      WHERE entidad = ? AND registro_id IN (?)
      ORDER BY registro_id, created_at, id`,
    [entidad, registroIds]
  );
  return filas;
}

// Todo lo de un proyecto: sus fases y las de sus actividades.
async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT t.entidad, t.registro_id, t.estado_anterior, t.estado_nuevo, t.created_at,
            u.nombre AS usuario_nombre
       FROM transiciones_estado t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.proyecto_id = ?
      ORDER BY t.created_at, t.id`,
    [proyectoId]
  );
  return filas;
}

module.exports = { registrar, listarPorRegistros, listarPorProyecto };
