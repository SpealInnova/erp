async function crear(pool, proyectoId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proyecto_actividades
      (proyecto_id, fase, categoria, descripcion, orden, responsable_id, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proyectoId,
      datos.fase,
      datos.categoria,
      datos.descripcion,
      datos.orden || 0,
      datos.responsable_id || null,
      datos.estado || "pendiente",
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function crearMuchas(pool, proyectoId, actividades, usuarioId) {
  if (actividades.length === 0) {
    return;
  }
  const valores = actividades.map((actividad) => [
    proyectoId,
    actividad.fase,
    actividad.categoria,
    actividad.descripcion,
    actividad.orden || 0,
    "pendiente",
    usuarioId || null,
  ]);
  await pool.query(
    `INSERT INTO proyecto_actividades
      (proyecto_id, fase, categoria, descripcion, orden, estado, created_by)
     VALUES ?`,
    [valores]
  );
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_actividades WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_actividades WHERE proyecto_id = ? AND deleted_at IS NULL ORDER BY orden, id",
    [proyectoId]
  );
  return filas;
}

async function contarPorProyectoYFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM proyecto_actividades WHERE proyecto_id = ? AND fase = ? AND deleted_at IS NULL",
    [proyectoId, fase]
  );
  return filas[0].total;
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    return;
  }
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  const valores = campos.map((campo) => datos[campo]);
  await pool.query(`UPDATE proyecto_actividades SET ${asignaciones} WHERE id = ?`, [
    ...valores,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyecto_actividades SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  crear,
  crearMuchas,
  obtenerPorId,
  listarPorProyecto,
  contarPorProyectoYFase,
  actualizar,
  softDelete,
};
