async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO clientes
      (nombre_razon_social, tipo_identificacion, numero_identificacion, pais, ciudad,
       direccion, contacto_nombre, contacto_telefono, contacto_email, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre_razon_social,
      datos.tipo_identificacion,
      datos.numero_identificacion,
      datos.pais || null,
      datos.ciudad || null,
      datos.direccion || null,
      datos.contacto_nombre || null,
      datos.contacto_telefono || null,
      datos.contacto_email || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function buscarPorNumeroIdentificacion(pool, numeroIdentificacion, excluirId = null) {
  const params = [numeroIdentificacion];
  let sql = "SELECT id FROM clientes WHERE numero_identificacion = ? AND deleted_at IS NULL";
  if (excluirId) {
    sql += " AND id != ?";
    params.push(excluirId);
  }
  const [filas] = await pool.query(sql, params);
  return filas[0] || null;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query("SELECT * FROM clientes WHERE id = ? AND deleted_at IS NULL", [
    id,
  ]);
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM clientes WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE clientes SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE clientes SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  crear,
  buscarPorNumeroIdentificacion,
  obtenerPorId,
  listar,
  actualizar,
  softDelete,
};
