async function crear(pool, expedienteId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO validaciones
      (expediente_id, aspecto_validado, metodo, condicion_prueba, resultado, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      expedienteId,
      datos.aspecto_validado,
      datos.metodo || null,
      datos.condicion_prueba || null,
      datos.resultado || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query("SELECT * FROM validaciones WHERE id = ? AND deleted_at IS NULL", [
    id,
  ]);
  return filas[0] || null;
}

async function listarPorExpediente(pool, expedienteId) {
  const [filas] = await pool.query(
    "SELECT * FROM validaciones WHERE expediente_id = ? AND deleted_at IS NULL ORDER BY id",
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
  await pool.query(`UPDATE validaciones SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE validaciones SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = { crear, obtenerPorId, listarPorExpediente, actualizar, softDelete };
