async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM requisiciones WHERE numero_requisicion LIKE ?",
    [`REQ-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM requisiciones WHERE numero_requisicion = ?", [
    numero,
  ]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.numero_requisicion, datos.proyecto_id, datos.solicitante_id, datos.procedencia, datos.estado]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM requisiciones WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM requisiciones WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE requisiciones SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE requisiciones SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE requisiciones SET deleted_at = NOW() WHERE id = ?", [id]);
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
