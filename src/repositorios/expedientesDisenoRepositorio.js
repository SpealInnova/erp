async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM expedientes_diseno WHERE codigo_expediente LIKE ?",
    [`EXP-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorCodigo(pool, codigo) {
  const [filas] = await pool.query("SELECT id FROM expedientes_diseno WHERE codigo_expediente = ?", [
    codigo,
  ]);
  return filas[0] || null;
}

async function buscarPorNumeroSerie(pool, numeroSerie, excluirId = null) {
  const params = [numeroSerie];
  let sql = "SELECT id FROM expedientes_diseno WHERE numero_serie = ? AND deleted_at IS NULL";
  if (excluirId) {
    sql += " AND id != ?";
    params.push(excluirId);
  }
  const [filas] = await pool.query(sql, params);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO expedientes_diseno
      (codigo_expediente, proyecto_id, producto_nombre, modelo, numero_serie,
       responsable_diseno_id, estado_liberacion, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.codigo_expediente,
      datos.proyecto_id,
      datos.producto_nombre,
      datos.modelo || null,
      datos.numero_serie || null,
      datos.responsable_diseno_id,
      datos.estado_liberacion,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM expedientes_diseno WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM expedientes_diseno WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
    [limite, offset]
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
  await pool.query(`UPDATE expedientes_diseno SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE expedientes_diseno SET estado_liberacion = ? WHERE id = ?", [
    estado,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE expedientes_diseno SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorCodigo,
  buscarPorNumeroSerie,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
};
