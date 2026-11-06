async function obtenerPorProyectoYUsuario(pool, proyectoId, usuarioId) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_equipo WHERE proyecto_id = ? AND usuario_id = ?",
    [proyectoId, usuarioId]
  );
  return filas[0] || null;
}

async function crear(pool, proyectoId, { usuarioId, rolEnProyecto, createdBy }) {
  const [resultado] = await pool.query(
    `INSERT INTO proyecto_equipo (proyecto_id, usuario_id, rol_en_proyecto, created_by)
     VALUES (?, ?, ?, ?)`,
    [proyectoId, usuarioId, rolEnProyecto, createdBy || null]
  );
  return resultado.insertId;
}

async function reactivar(pool, id, { rolEnProyecto, createdBy }) {
  await pool.query(
    `UPDATE proyecto_equipo
     SET rol_en_proyecto = ?, created_by = ?, deleted_at = NULL
     WHERE id = ?`,
    [rolEnProyecto, createdBy || null, id]
  );
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_equipo WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT pe.*, u.nombre AS usuario_nombre
     FROM proyecto_equipo pe
     JOIN usuarios u ON u.id = pe.usuario_id
     WHERE pe.proyecto_id = ? AND pe.deleted_at IS NULL
     ORDER BY pe.created_at, pe.id`,
    [proyectoId]
  );
  return filas;
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyecto_equipo SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  obtenerPorProyectoYUsuario,
  crear,
  reactivar,
  obtenerPorId,
  listarPorProyecto,
  softDelete,
};
