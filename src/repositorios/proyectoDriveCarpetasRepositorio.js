async function obtenerPorProyectoYFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_drive_carpetas WHERE proyecto_id = ? AND fase = ?",
    [proyectoId, fase]
  );
  return filas[0] || null;
}

async function crear(pool, { proyectoId, fase, driveFolderId }) {
  const [resultado] = await pool.query(
    "INSERT INTO proyecto_drive_carpetas (proyecto_id, fase, drive_folder_id) VALUES (?, ?, ?)",
    [proyectoId, fase, driveFolderId]
  );
  return resultado.insertId;
}

module.exports = { obtenerPorProyectoYFase, crear };
