async function crear(pool, reporteId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO parametros_medidos
      (reporte_id, parametro, unidad, valor_medido, valor_esperado, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reporteId,
      datos.parametro,
      datos.unidad || null,
      datos.valor_medido || null,
      datos.valor_esperado || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM parametros_medidos WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorReporte(pool, reporteId) {
  const [filas] = await pool.query(
    "SELECT * FROM parametros_medidos WHERE reporte_id = ? AND deleted_at IS NULL ORDER BY id",
    [reporteId]
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
  await pool.query(`UPDATE parametros_medidos SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE parametros_medidos SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = { crear, obtenerPorId, listarPorReporte, actualizar, softDelete };
