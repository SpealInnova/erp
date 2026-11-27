// Responsables de cada etapa (fase) de un proyecto; varios por etapa.

async function obtenerPorClave(pool, { proyectoId, fase, usuarioId }) {
  const [filas] = await pool.query(
    `SELECT * FROM proyecto_fase_responsables
      WHERE proyecto_id = ? AND fase = ? AND usuario_id = ?`,
    [proyectoId, fase, usuarioId]
  );
  return filas[0] || null;
}

async function crear(pool, { proyectoId, fase, usuarioId, createdBy }) {
  const [resultado] = await pool.query(
    `INSERT INTO proyecto_fase_responsables (proyecto_id, fase, usuario_id, created_by)
     VALUES (?, ?, ?, ?)`,
    [proyectoId, fase, usuarioId, createdBy || null]
  );
  return resultado.insertId;
}

// Vuelve a asignar a alguien que se había quitado (la clave es única).
async function reactivar(pool, id, { createdBy }) {
  await pool.query(
    `UPDATE proyecto_fase_responsables
        SET created_by = ?, created_at = NOW(), deleted_at = NULL
      WHERE id = ?`,
    [createdBy || null, id]
  );
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_fase_responsables WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Vigentes del proyecto, con nombre y cargo, en el orden en que se asignaron.
async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT r.id, r.proyecto_id, r.fase, r.usuario_id, r.created_at,
            u.nombre AS usuario_nombre, u.cargo AS usuario_cargo
       FROM proyecto_fase_responsables r
       JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.proyecto_id = ? AND r.deleted_at IS NULL
      ORDER BY r.created_at, r.id`,
    [proyectoId]
  );
  return filas;
}

async function listarUsuariosDeFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    `SELECT usuario_id FROM proyecto_fase_responsables
      WHERE proyecto_id = ? AND fase = ? AND deleted_at IS NULL`,
    [proyectoId, fase]
  );
  return filas.map((f) => f.usuario_id);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyecto_fase_responsables SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  obtenerPorClave,
  crear,
  reactivar,
  obtenerPorId,
  listarPorProyecto,
  listarUsuariosDeFase,
  softDelete,
};
