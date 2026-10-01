async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM ordenes_compra WHERE numero_oc LIKE ?",
    [`OC-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM ordenes_compra WHERE numero_oc = ?", [numero]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.numero_oc, datos.requisicion_id, datos.proveedor_id, datos.estado, datos.created_by]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM ordenes_compra WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM ordenes_compra WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE ordenes_compra SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado, { aprobadoPor, aprobadoEn } = {}) {
  if (aprobadoPor) {
    await pool.query(
      "UPDATE ordenes_compra SET estado = ?, aprobado_por = ?, aprobado_en = ? WHERE id = ?",
      [estado, aprobadoPor, aprobadoEn, id]
    );
    return;
  }
  await pool.query("UPDATE ordenes_compra SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE ordenes_compra SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorNumero,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
};
