async function crear(pool, expedienteId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO riesgos_diseno
      (expediente_id, peligro, situacion_peligrosa, dano_potencial, severidad, probabilidad, control, responsable_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expedienteId,
      datos.peligro,
      datos.situacion_peligrosa || null,
      datos.dano_potencial || null,
      datos.severidad || null,
      datos.probabilidad || null,
      datos.control || null,
      datos.responsable_id,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM riesgos_diseno WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorExpediente(pool, expedienteId) {
  const [filas] = await pool.query(
    "SELECT * FROM riesgos_diseno WHERE expediente_id = ? AND deleted_at IS NULL ORDER BY id",
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
  await pool.query(`UPDATE riesgos_diseno SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE riesgos_diseno SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = { crear, obtenerPorId, listarPorExpediente, actualizar, softDelete };
