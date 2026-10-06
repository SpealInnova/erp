async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM actas_cierre_satisfaccion WHERE numero_acta LIKE ?",
    [`ACS-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query(
    "SELECT id FROM actas_cierre_satisfaccion WHERE numero_acta = ?",
    [numero]
  );
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO actas_cierre_satisfaccion
      (numero_acta, proyecto_id, cliente_id, tipo_entrega, tipo_documento_referencia,
       numero_documento_referencia, objeto, responsable_entrega_id, receptor_cliente_nombre,
       receptor_cliente_cargo, fecha_elaboracion, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_acta,
      datos.proyecto_id,
      datos.cliente_id,
      datos.tipo_entrega,
      datos.tipo_documento_referencia,
      datos.numero_documento_referencia || null,
      datos.objeto,
      datos.responsable_entrega_id,
      datos.receptor_cliente_nombre,
      datos.receptor_cliente_cargo || null,
      datos.fecha_elaboracion,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM actas_cierre_satisfaccion WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM actas_cierre_satisfaccion WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  await pool.query(`UPDATE actas_cierre_satisfaccion SET ${asignaciones} WHERE id = ?`, [
    ...valores,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE actas_cierre_satisfaccion SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorNumero,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  softDelete,
};
