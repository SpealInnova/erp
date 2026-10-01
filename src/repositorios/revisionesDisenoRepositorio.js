async function contarPorExpediente(pool, expedienteId) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM revisiones_diseno WHERE expediente_id = ?",
    [expedienteId]
  );
  return filas[0].total;
}

async function crear(pool, expedienteId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO revisiones_diseno
      (expediente_id, numero, fecha, hallazgos, acciones, responsable_id, cierre, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expedienteId,
      datos.numero,
      datos.fecha || null,
      datos.hallazgos || null,
      datos.acciones || null,
      datos.responsable_id,
      datos.cierre || "no",
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM revisiones_diseno WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorExpediente(pool, expedienteId) {
  const [filas] = await pool.query(
    "SELECT * FROM revisiones_diseno WHERE expediente_id = ? AND deleted_at IS NULL ORDER BY numero",
    [expedienteId]
  );
  return filas;
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    return;
  }
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  const valores = campos.map((campo) => datos[campo]);
  await pool.query(`UPDATE revisiones_diseno SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE revisiones_diseno SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorExpediente,
  crear,
  obtenerPorId,
  listarPorExpediente,
  actualizar,
  softDelete,
};
