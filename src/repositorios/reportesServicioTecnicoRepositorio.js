async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM reportes_servicio_tecnico WHERE numero_reporte LIKE ?",
    [`RST-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query(
    "SELECT id FROM reportes_servicio_tecnico WHERE numero_reporte = ?",
    [numero]
  );
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO reportes_servicio_tecnico
      (numero_reporte, equipo_numero_serie, cliente_id, proyecto_id, tipo_servicio, en_garantia,
       tecnico_responsable_id, motivo, hallazgos, recomendaciones, fecha_servicio, hora_inicio,
       hora_fin, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_reporte,
      datos.equipo_numero_serie,
      datos.cliente_id,
      datos.proyecto_id || null,
      datos.tipo_servicio,
      datos.en_garantia ? 1 : 0,
      datos.tecnico_responsable_id,
      datos.motivo || null,
      datos.hallazgos || null,
      datos.recomendaciones || null,
      datos.fecha_servicio || null,
      datos.hora_inicio || null,
      datos.hora_fin || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM reportes_servicio_tecnico WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM reportes_servicio_tecnico WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
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
  const valores = campos.map((campo) =>
    campo === "en_garantia" ? (datos[campo] ? 1 : 0) : datos[campo]
  );
  await pool.query(`UPDATE reportes_servicio_tecnico SET ${asignaciones} WHERE id = ?`, [
    ...valores,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE reportes_servicio_tecnico SET deleted_at = NOW() WHERE id = ?", [id]);
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
