async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM proyectos WHERE codigo_pry LIKE ?",
    [`PRY-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorCodigoPry(pool, codigoPry) {
  const [filas] = await pool.query("SELECT id FROM proyectos WHERE codigo_pry = ?", [codigoPry]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proyectos
      (codigo_pry, cliente_id, cotizacion_id, linea_negocio, nombre_proyecto, estado, responsable_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.codigo_pry,
      datos.cliente_id,
      datos.cotizacion_id || null,
      datos.linea_negocio || null,
      datos.nombre_proyecto,
      datos.estado,
      datos.responsable_id,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyectos WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM proyectos WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE proyectos SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE proyectos SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyectos SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorCodigoPry,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
};
