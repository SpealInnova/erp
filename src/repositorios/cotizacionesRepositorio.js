async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM cotizaciones WHERE numero_cotizacion LIKE ?",
    [`COT-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM cotizaciones WHERE numero_cotizacion = ?", [
    numero,
  ]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO cotizaciones
      (numero_cotizacion, cliente_id, asesor_comercial_id, estado, fecha_validez, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_cotizacion,
      datos.cliente_id,
      datos.asesor_comercial_id,
      datos.estado,
      datos.fecha_validez || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM cotizaciones WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM cotizaciones WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE cotizaciones SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE cotizaciones SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE cotizaciones SET deleted_at = NOW() WHERE id = ?", [id]);
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
