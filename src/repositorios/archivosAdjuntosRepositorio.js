async function crear(pool, { tabla, registroId, nombreArchivo, mimeType, tamanoBytes, driveFileId, driveEnlace, subidoPor }) {
  const [resultado] = await pool.query(
    `INSERT INTO archivos_adjuntos
       (tabla, registro_id, nombre_archivo, mime_type, tamano_bytes, drive_file_id, drive_enlace, subido_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tabla, registroId, nombreArchivo, mimeType, tamanoBytes, driveFileId, driveEnlace || null, subidoPor || null]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM archivos_adjuntos WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorRegistro(pool, tabla, registroId) {
  const [filas] = await pool.query(
    `SELECT aa.*, u.nombre AS subido_por_nombre
     FROM archivos_adjuntos aa
     LEFT JOIN usuarios u ON u.id = aa.subido_por
     WHERE aa.tabla = ? AND aa.registro_id = ? AND aa.deleted_at IS NULL
     ORDER BY aa.created_at, aa.id`,
    [tabla, registroId]
  );
  return filas;
}

async function softDelete(pool, id) {
  await pool.query("UPDATE archivos_adjuntos SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = { crear, obtenerPorId, listarPorRegistro, softDelete };
